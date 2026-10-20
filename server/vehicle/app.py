"""Local Volkswagen website bridge. All vehicle operations are reads.

Start from repo root: .venv-vehicle/bin/python server/vehicle/app.py
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from pathlib import Path
import re
import secrets
import time
from urllib.parse import urlparse

from aiohttp import web
import httpx
from vendor.http2_session import Http2Session
from vendor.website_portal import WebsitePortalClient, WebsitePortalAuthError, WebsitePortalConsentRequired, WebsitePortalOtpRequired, WebsitePortalVehicleError
from data import snapshot
from charger import Charger

logging.getLogger("vendor.website_portal").disabled = True
logging.getLogger("httpx").disabled = True
logging.getLogger("httpcore").disabled = True
COOKIE = "domoryx_vehicle"
POLL_SECONDS = 300
TTL = 7 * 86400


class Portal(WebsitePortalClient):
    async def _refresh_or_relogin(self):
        # Session cookies can renew silently. No password storage or automatic
        # credential retries: the user explicitly signs in again if SSO expires.
        await self._silent_refresh()

    async def vehicles(self):
        status, body = await self._get("/app/authproxy/vw-de/proxy/v2/users/me/relations?resourceHost=myvw-vum-prod")
        if status != 200:
            raise WebsitePortalAuthError("Vehicle list unavailable")
        payload = json.loads(body)
        found = {}
        def walk(item):
            if isinstance(item, dict):
                vin = item.get("vin")
                if isinstance(vin, str) and re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", vin):
                    name = item.get("vehicleNickname") or item.get("nickname") or item.get("modelName")
                    found[vin] = {"vin": vin, "name": name[:80] if isinstance(name, str) else "Volkswagen · " + vin[-6:]}
                for value in item.values():
                    walk(value)
            elif isinstance(item, list):
                for value in item:
                    walk(value)
        walk(payload)
        return list(found.values())


class Session:
    def __init__(self, sid, email="", password=""):
        self.sid = sid
        self.http = httpx.AsyncClient(http2=True, timeout=30, follow_redirects=False)
        self.portal = Portal(Http2Session(self.http), email, password)
        self.phase = "otp_required"
        self.vehicles = []
        self.vin = None
        self.data = None
        self.message = None
        self.last_poll = 0.0
        self.created = time.time()
        self.consent_url = None
        self.otp_attempts = 0
        self.lock = asyncio.Lock()

    def public(self):
        return {"phase": self.phase, "vehicles": self.vehicles, "selectedVin": self.vin, "data": self.data, "message": self.message, "pollSeconds": POLL_SECONDS, "consentUrl": self.consent_url}


class Bridge:
    def __init__(self, directory=None):
        self.directory = Path(directory or os.environ.get("DOMORYX_VEHICLE_DATA", ".vehicle-data"))
        self.charger = Charger(self.directory)
        self.sessions = {}
        self.last_login = 0.0
        self.login_lock = asyncio.Lock()

    def save(self, session):
        if session.phase == "otp_required":
            return
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.directory, 0o700)
        path = self.directory / (session.sid + ".json")
        body = {"cookies": session.portal.export_cookies(), "created": session.created, "vehicles": session.vehicles, "vin": session.vin, "data": session.data, "phase": session.phase}
        temporary = path.with_suffix(".tmp")
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump(body, output, allow_nan=False)
        temporary.replace(path)

    def get(self, request):
        sid = request.cookies.get(COOKIE, "")
        if not re.fullmatch(r"[a-f0-9]{64}", sid):
            return None
        if sid in self.sessions:
            session = self.sessions[sid]
            if time.time() - session.created < TTL:
                return session
            return None
        try:
            saved = json.loads((self.directory / (sid + ".json")).read_text())
            if time.time() - saved["created"] >= TTL:
                return None
            session = Session(sid)
            session.portal.import_cookies(saved["cookies"])
            session.created = saved["created"]
            session.vehicles = saved.get("vehicles", [])
            session.vin = saved.get("vin")
            session.data = saved.get("data")
            session.phase = saved.get("phase", "connected")
            self.sessions[sid] = session
            return session
        except (OSError, ValueError, KeyError, TypeError):
            return None

    async def finish_login(self, session):
        session.portal._password = ""
        session.portal._email = ""
        session.vehicles = await session.portal.vehicles()
        preferred = next((v for v in session.vehicles if re.search(r"id[.\s_-]*4", v["name"], re.I)), None)
        session.vin = preferred["vin"] if preferred else session.vehicles[0]["vin"] if len(session.vehicles) == 1 else None
        session.phase = "connected"
        session.message = None if session.vehicles else "Aucun véhicule accessible. Vérifiez votre compte et l’activation du véhicule sur myVolkswagen."
        self.save(session)

    async def poll(self, session):
        if not session.vin or session.phase != "connected" or time.monotonic() - session.last_poll < POLL_SECONDS:
            return
        session.last_poll = time.monotonic()
        try:
            charging = await session.portal.get_charging(session.vin)
            warnings = []
            try:
                maintenance = await session.portal.get_maintenance(session.vin)
            except WebsitePortalAuthError:
                raise
            except Exception:
                maintenance = {}
                warnings.append("Kilométrage et entretien indisponibles.")
            if not charging:
                session.message = "Volkswagen ne fournit pas les données de recharge. Vérifiez les services connectés et votre statut d’utilisateur principal sur myVolkswagen."
            else:
                session.data = snapshot(session.vin, charging, maintenance, int(time.time() * 1000))
                session.message = " ".join(warnings) or None
            self.save(session)
        except WebsitePortalConsentRequired:
            session.phase = "consent_required"
            session.message = "Une validation est demandée sur myVolkswagen. Ouvrez le portail officiel, vérifiez la demande puis reconnectez-vous ici."
            self.save(session)
        except (WebsitePortalAuthError, WebsitePortalOtpRequired):
            session.phase = "reauth_required"
            session.message = "La session Volkswagen a expiré. Reconnectez-vous pour reprendre la synchronisation."
            self.save(session)
        except WebsitePortalVehicleError:
            session.message = "Volkswagen refuse l’accès aux données du véhicule. Vérifiez les services connectés et l’activation du compte sur myVolkswagen."
        except Exception:
            session.message = "Volkswagen est injoignable. Les dernières valeurs sont conservées."

    async def capture_consent(self, session, error):
        candidate = getattr(error, "consent_url", None)
        parsed = urlparse(candidate or "")
        session.consent_url = None
        # Never send a third-party redirect or an arbitrary URL to the browser.
        if parsed.scheme == "https" and parsed.hostname == "identity.vwgroup.io" and parsed.path == "/v2/login/ui/consent":
            session.consent_url = candidate
        session.phase = "consent_required"
        session.message = "Volkswagen demande l’autorisation d’accès à votre compte. Ouvrez la page d’autorisation ci-dessous, puis reprenez la connexion."
        self.save(session)

    async def status(self, request):
        session = self.get(request)
        if session and session.phase == "consent_required" and not session.consent_url:
            async with session.lock:
                try:
                    await asyncio.wait_for(session.portal.refresh(), 90)
                    await self.finish_login(session)
                except WebsitePortalConsentRequired as error:
                    await self.capture_consent(session, error)
                except WebsitePortalAuthError:
                    session.phase = "reauth_required"
                    session.message = "La session Volkswagen doit être renouvelée. Reconnectez-vous ici."
                    self.save(session)
                except Exception:
                    session.message = "Ouvrez votre compte Volkswagen en français puis reprenez la connexion."
        return web.json_response(session.public() if session else {"phase": "disconnected", "vehicles": [], "selectedVin": None, "data": None, "pollSeconds": POLL_SECONDS})

    async def login(self, request):
        body = await request.json()
        email, password = body.get("email", ""), body.get("password", "")
        if not isinstance(email, str) or not isinstance(password, str) or not email.strip() or not password or len(email) > 254 or len(password) > 1024:
            return web.json_response({"error": "Saisissez votre e-mail et votre mot de passe Volkswagen."}, status=400)
        async with self.login_lock:
            if time.monotonic() - self.last_login < 60:
                return web.json_response({"error": "Attendez une minute avant une nouvelle tentative de connexion."}, status=429)
            self.last_login = time.monotonic()
            session = Session(secrets.token_hex(32), email.strip(), password)
            try:
                result = await asyncio.wait_for(session.portal.begin_login(), 90)
                session.portal._password = ""
                if result == "ok":
                    await asyncio.wait_for(self.finish_login(session), 60)
                elif result != "otp_required":
                    raise WebsitePortalAuthError("Unsupported challenge")
                previous = self.get(request)
                self.sessions[session.sid] = session
                if previous:
                    await self.remove(previous)
                response = web.json_response(session.public())
                response.set_cookie(COOKIE, session.sid, httponly=True, samesite="Strict", secure=request.headers.get("Origin", "").startswith("https://"), max_age=TTL, path="/api/vehicle")
                return response
            except WebsitePortalConsentRequired:
                return web.json_response({"error": "Une validation est demandée sur le portail officiel myVolkswagen. Terminez-la dans votre navigateur, puis réessayez."}, status=409)
            except WebsitePortalAuthError:
                return web.json_response({"error": "Connexion refusée par Volkswagen. Vérifiez vos identifiants et votre accès à myVolkswagen."}, status=401)
            except Exception:
                return web.json_response({"error": "Connexion au portail Volkswagen impossible pour le moment. Réessayez dans quelques minutes."}, status=502)
            finally:
                session.portal._password = ""
                if session.sid not in self.sessions:
                    await session.http.aclose()

    async def otp(self, request):
        session = self.get(request)
        if not session or session.phase != "otp_required" or time.time() - session.created > 600:
            return web.json_response({"error": "Le code a expiré. Recommencez la connexion."}, status=401)
        body = await request.json()
        code = body.get("code", "")
        if not isinstance(code, str) or not re.fullmatch(r"[0-9]{4,8}", code):
            return web.json_response({"error": "Saisissez le code reçu par e-mail."}, status=400)
        async with session.lock:
            if session.otp_attempts >= 5:
                return web.json_response({"error": "Trop de tentatives. Recommencez la connexion."}, status=429)
            session.otp_attempts += 1
            try:
                await asyncio.wait_for(session.portal.submit_otp(code), 90)
                await asyncio.wait_for(self.finish_login(session), 60)
                return web.json_response(session.public())
            except WebsitePortalConsentRequired as error:
                await self.capture_consent(session, error)
                return web.json_response({**session.public(), "error": session.message}, status=409)
            except WebsitePortalAuthError:
                return web.json_response({"error": "Code refusé ou expiré. Utilisez le dernier e-mail reçu de Volkswagen."}, status=401)
            except Exception:
                return web.json_response({"error": "Le portail Volkswagen n’a pas pu valider le code."}, status=502)

    async def data(self, request):
        session = self.get(request)
        if not session:
            return web.json_response({"error": "Connectez votre compte Volkswagen."}, status=401)
        async with session.lock:
            await asyncio.wait_for(self.poll(session), 150)
            return web.json_response(session.public())

    async def resume(self, request):
        session = self.get(request)
        if not session:
            return web.json_response({"error": "Reconnectez votre compte Volkswagen.", "phase": "reauth_required"}, status=401)
        async with session.lock:
            try:
                await asyncio.wait_for(session.portal.refresh(), 90)
                await self.finish_login(session)
                session.consent_url = None
                session.last_poll = 0
                await self.poll(session)
                return web.json_response(session.public())
            except WebsitePortalConsentRequired as error:
                await self.capture_consent(session, error)
                return web.json_response({**session.public(), "error": "L’autorisation Volkswagen est encore demandée. Ouvrez le bouton d’autorisation."}, status=409)
            except WebsitePortalAuthError:
                session.phase = "reauth_required"
                self.save(session)
                return web.json_response({"error": "Reconnectez-vous avec un nouveau code Volkswagen.", "phase": session.phase}, status=401)

    async def select(self, request):
        session = self.get(request)
        if not session or session.phase != "connected":
            return web.json_response({"error": "Connectez votre compte Volkswagen."}, status=401)
        body = await request.json()
        async with session.lock:
            if body.get("vin") not in {v["vin"] for v in session.vehicles}:
                return web.json_response({"error": "Véhicule absent de votre compte."}, status=400)
            if session.vin != body["vin"]:
                session.vin = body["vin"]
                session.data = None
                session.last_poll = 0
                self.save(session)
            return web.json_response(session.public())

    async def remove(self, session):
        self.sessions.pop(session.sid, None)
        (self.directory / (session.sid + ".json")).unlink(missing_ok=True)
        await session.http.aclose()

    async def logout(self, request):
        session = self.get(request)
        if session:
            async with session.lock:
                await self.remove(session)
        response = web.json_response({"phase": "disconnected", "vehicles": [], "data": None, "selectedVin": None, "pollSeconds": POLL_SECONDS})
        response.del_cookie(COOKIE, path="/api/vehicle")
        return response

    async def charger_data(self, request):
        # Local, read-only telemetry is independent of Volkswagen cloud login.
        # The shared origin/header guard still applies to this endpoint.
        return web.json_response(await self.charger.status())

    async def close(self, _app):
        for session in self.sessions.values():
            await session.http.aclose()

    async def charger_collector(self, _app):
        task = asyncio.create_task(self.charger.collect())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        if self.charger.archive.value.get("active"):
            self.charger.archive.save()


@web.middleware
async def guard(request, handler):
    if request.headers.get("X-Domoryx-Vehicle") != "1":
        response = web.json_response({"error": "Accès refusé."}, status=403)
    elif request.headers.get("Origin") and urlparse(request.headers["Origin"]).netloc != request.host:
        response = web.json_response({"error": "Origine de la demande refusée."}, status=403)
    elif request.method == "POST" and (request.content_type != "application/json" or urlparse(request.headers.get("Origin", "")).netloc != request.host):
        response = web.json_response({"error": "Origine de la demande refusée."}, status=403)
    else:
        try:
            response = await handler(request)
        except (json.JSONDecodeError, AttributeError, TypeError):
            response = web.json_response({"error": "Demande invalide."}, status=400)
        except Exception:
            response = web.json_response({"error": "Service véhicule temporairement indisponible."}, status=503)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def create_app(directory=None):
    bridge = Bridge(directory)
    app = web.Application(middlewares=[guard], client_max_size=8192)
    app.add_routes([web.get("/api/vehicle/charger", bridge.charger_data), web.get("/api/vehicle/status", bridge.status), web.post("/api/vehicle/login", bridge.login), web.post("/api/vehicle/otp", bridge.otp), web.get("/api/vehicle/data", bridge.data), web.post("/api/vehicle/resume", bridge.resume), web.post("/api/vehicle/select", bridge.select), web.post("/api/vehicle/logout", bridge.logout)])
    app.on_cleanup.append(bridge.close)
    app.cleanup_ctx.append(bridge.charger_collector)
    return app


if __name__ == "__main__":
    web.run_app(create_app(), host="127.0.0.1", port=int(os.environ.get("DOMORYX_VEHICLE_PORT", "8766")), access_log=None, print=lambda _: print("Service véhicule Domoryx prêt sur 127.0.0.1:8766"))
