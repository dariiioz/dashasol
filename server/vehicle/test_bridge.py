import asyncio
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, patch
from aiohttp.test_utils import TestClient, TestServer
from aiohttp import CookieJar
from app import Bridge, Session, Portal, create_app
from data import snapshot
from vendor.website_portal import WebsitePortalAuthError, WebsitePortalConsentRequired

VIN = "WVGZZZE2ZMP000001"

class ValuesTest(unittest.TestCase):
    def test_zero_and_missing_fields(self):
        data = snapshot(VIN, {"soc": 0, "charge_power": 0, "charge_time_remaining": 0, "electric_range": 0}, {}, 123)
        self.assertEqual(data["battery"], 0)
        self.assertEqual(data["power"], 0)
        self.assertEqual(data["remainingMinutes"], 0)
        self.assertIsNone(data["reportedAt"])
        self.assertIsNone(data["odometer"])

    def test_invalid_values_and_dates_never_look_current(self):
        data = snapshot(VIN, {"soc": 255, "charge_power": "nan", "battery_temp": 65535, "reported_at": "0001-01-01T00:00:00Z", "charging_reported_at": "2026-10-18T09:00:00Z"}, {}, 123)
        for key in ("battery", "power", "batteryTemperature", "reportedAt"):
            self.assertIsNone(data[key])
        self.assertEqual(data["chargingReportedAt"], "2026-10-18T09:00:00+00:00")
        self.assertNotIn("password", data)

class BridgeTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.bridge = Bridge(self.directory.name)
        self.session = Session("a" * 64)
        self.session.phase = "connected"
        self.session.vin = VIN
        self.session.vehicles = [{"vin": VIN, "name": "ID.4"}]

    async def asyncTearDown(self):
        await self.session.http.aclose()
        self.directory.cleanup()

    async def test_poll_deduplicates_and_retains_snapshot_on_failure(self):
        self.session.portal.get_charging = AsyncMock(return_value={"soc": 73, "reported_at": "2026-10-18T09:00:00Z"})
        self.session.portal.get_maintenance = AsyncMock(return_value={"mileage_km": 22000})
        await self.bridge.poll(self.session)
        previous = self.session.data
        await self.bridge.poll(self.session)
        self.assertEqual(self.session.portal.get_charging.await_count, 1)
        self.session.last_poll = 0
        self.session.portal.get_charging.side_effect = RuntimeError("secret upstream response")
        await self.bridge.poll(self.session)
        self.assertEqual(self.session.data, previous)
        self.assertNotIn("secret", self.session.message)

    async def test_session_expiry_does_not_retry_password_or_erase_readings(self):
        self.session.data = {"battery": 73}
        self.session.portal.get_charging = AsyncMock(side_effect=WebsitePortalAuthError("secret"))
        await self.bridge.poll(self.session)
        self.assertEqual(self.session.phase, "reauth_required")
        self.assertEqual(self.session.data["battery"], 73)
        await self.bridge.poll(self.session)
        self.assertEqual(self.session.portal.get_charging.await_count, 1)

    async def test_cookie_store_is_private_and_contains_no_password(self):
        self.session.portal._password = "private-test-password"
        self.bridge.save(self.session)
        path = Path(self.directory.name) / (self.session.sid + ".json")
        self.assertNotIn("private-test-password", path.read_text())
        if os.name != 'nt':
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            self.assertEqual(os.stat(self.directory.name).st_mode & 0o777, 0o700)
        else:
            self.assertTrue(os.access(path, os.R_OK | os.W_OK))

    async def test_read_payload_does_not_leak_credentials_or_cookies(self):
        self.assertNotIn("password", self.session.public())
        self.assertNotIn("cookies", self.session.public())
        self.assertNotIn("sid", self.session.public())

class HttpTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.client = TestClient(TestServer(create_app(self.directory.name)), cookie_jar=CookieJar(unsafe=True))
        await self.client.start_server()
        self.origin = str(self.client.make_url("/")).rstrip("/")
        self.headers = {"X-Domoryx-Vehicle": "1", "Origin": self.origin}

    async def asyncTearDown(self):
        await self.client.close()
        self.directory.cleanup()

    async def test_no_data_without_session_and_no_cross_origin_login(self):
        response = await self.client.get("/api/vehicle/data", headers=self.headers)
        self.assertEqual(response.status, 401)
        response = await self.client.get("/api/vehicle/charger", headers=self.headers)
        self.assertEqual(response.status, 200)
        self.assertFalse((await response.json())["configured"])
        response = await self.client.get("/api/vehicle/charger")
        self.assertEqual(response.status, 403)
        response = await self.client.get("/api/vehicle/charger", headers={**self.headers, "Origin": "https://other.example"})
        self.assertEqual(response.status, 403)
        response = await self.client.get("/api/vehicle/status")
        self.assertEqual(response.status, 403)
        response = await self.client.post("/api/vehicle/login", json={"email": "test@example.org", "password": "test"}, headers={**self.headers, "Origin": "https://other.example"})
        self.assertEqual(response.status, 403)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    async def test_consent_wall_exits_otp_and_requires_explicit_reconnection(self):
        with patch.object(Portal, "begin_login", new=AsyncMock(return_value="otp_required")):
            await self.client.post("/api/vehicle/login", json={"email": "test@example.org", "password": "test"}, headers=self.headers)
        with patch.object(Portal, "submit_otp", new=AsyncMock(side_effect=WebsitePortalConsentRequired("private portal URL"))):
            response = await self.client.post("/api/vehicle/otp", json={"code": "123456"}, headers=self.headers)
            self.assertEqual(response.status, 409)
            data = await response.json()
            self.assertEqual(data["phase"], "consent_required")
            self.assertNotIn("private portal URL", json.dumps(data))
        with patch.object(Portal, "refresh", new=AsyncMock(side_effect=WebsitePortalConsentRequired("consent required", "https://identity.vwgroup.io/v2/login/ui/consent?state=test"))):
            response = await self.client.get("/api/vehicle/status", headers=self.headers)
        data = await response.json()
        self.assertEqual(data["phase"], "consent_required")
        self.assertTrue(data["consentUrl"].startswith("https://identity.vwgroup.io/"))

    async def test_otp_flow_uses_http_only_cookie_and_clears_password(self):
        with patch.object(Portal, "begin_login", new=AsyncMock(return_value="otp_required")):
            response = await self.client.post("/api/vehicle/login", json={"email": "test@example.org", "password": "private-test-password"}, headers=self.headers)
            self.assertEqual(response.status, 200)
            cookie = response.headers["Set-Cookie"]
            self.assertIn("HttpOnly", cookie)
            self.assertIn("SameSite=Strict", cookie)
            self.assertNotIn("private-test-password", await response.text())
        with patch.object(Portal, "submit_otp", new=AsyncMock(return_value="ok")), patch.object(Portal, "vehicles", new=AsyncMock(return_value=[{"vin": VIN, "name": "ID.4"}])):
            response = await self.client.post("/api/vehicle/otp", json={"code": "123456"}, headers=self.headers)
            self.assertEqual(response.status, 200)
            self.assertEqual((await response.json())["phase"], "connected")
        response = await self.client.post("/api/vehicle/select", json={"vin": "WVGZZZE2ZMP999999"}, headers=self.headers)
        self.assertEqual(response.status, 400)
        response = await self.client.post("/api/vehicle/logout", json={}, headers=self.headers)
        self.assertEqual(response.status, 200)
        self.assertFalse(list(Path(self.directory.name).glob("*.json")))

if __name__ == "__main__":
    unittest.main()
