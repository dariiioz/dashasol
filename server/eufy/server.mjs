import http from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdirSync, chmodSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { EufyMega, LoginStatus } from '@mega-yfue/eufy-sdk';
import { smoothVideoFragment } from './smooth-fragments.mjs';
const directory = resolve(process.env.DOMORYX_EUFY_DATA || '.eufy-data');
mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
const sessions = new Map(); const TTL = 7 * 86400000; let lastLogin = 0;
const cookieName = 'domoryx_eufy';
function privateWrite(path, value) { writeFileSync(path + '.tmp', JSON.stringify(value), { mode: 0o600 }); chmodSync(path + '.tmp', 0o600); renameSync(path + '.tmp', path); }
function remove(path) { try { unlinkSync(path); } catch {} }
function storeFor(id) { const path = resolve(directory, id + '.json'); return { load() { try { const saved = JSON.parse(readFileSync(path, 'utf8')); return Date.now() - saved.savedAt * (saved.savedAt < 1e12 ? 1000 : 1) < TTL ? saved : null; } catch { return null; } }, save(value) { privateWrite(path, value); }, clear() { remove(path); } }; }
function connectSession(id) {
  const session = { id, created: Date.now(), phase: 'disconnected', devices: [], events: [], selected: null, busy: false, message: undefined, lastRead: 0 };
  sessions.set(id, session); return session;
}
function makeClient(session, email = '', password = '') {
  session.options = { email, password, countryCode: 'FR', openudid: session.id.slice(0, 32), store: storeFor(session.id), pushStore: { load() { try { return JSON.parse(readFileSync(resolve(directory, session.id + '.push.json'), 'utf8')); } catch { return null; } }, save(value) { privateWrite(resolve(directory, session.id + '.push.json'), value); }, clear() { remove(resolve(directory, session.id + '.push.json')); } }, noBroadcast: false, pollMs: 600000 };
  const client = new EufyMega(session.options); session.client = client;
  const registerPush = client.api.registerPushToken.bind(client.api);
  client.api.registerPushToken = async token => {
    try { await registerPush(token); session.pushRegistration = 'registered'; }
    catch (error) {
      // T8210/HomeBase 2 accounts can reject the mega endpoint before the SDK
      // reaches its eufySecurity registration. Use those same SDK legacy calls.
      if (error.code === 10003 && String(error.message).startsWith('/app/push/register_push_token failed')) {
        try {
          await client.api.securityAppPost('/v1/apppush/register_push_token', { is_notification_enable: true, token, transaction: String(Date.now()) });
          await client.api.securityAppPost('/v1/app/review/app_push_check', { app_type: 'eufySecurity', transaction: String(Date.now()) });
          session.pushRegistration = 'registered'; return;
        } catch { session.pushRegistration = 'failed'; throw new Error('Push registration unavailable'); }
      }
      session.pushRegistration = 'failed'; throw error;
    }
  };
  client.on('error', error => { session.channelErrors = [...new Set([...(session.channelErrors || []), ...['push', 'fcm', 'mqtt', 'p2p', 'ppcs', 'timeout', 'authentication', 'unauthorized', 'connection', 'certificate', 'decrypt'].filter(word => String(error.message).toLowerCase().includes(word))])]; session.message = 'Un canal Eufy est indisponible. Les données connues restent affichées.'; });
  client.on('sessionExpired', () => { session.phase = 'reauth_required'; session.message = 'Reconnecte ton compte Eufy.'; });
  for (const kind of ['doorbellPress', 'motion', 'personDetected']) client.on(kind, event => {
    if (!event.deviceSn || !session.devices.some(device => device.sn === event.deviceSn)) return;
    session.events.unshift({ id: randomBytes(12).toString('hex'), kind, deviceSn: event.deviceSn, receivedAt: Date.now() }); session.events.length = Math.min(session.events.length, 50);
  });
  return client;
}
async function roster(session) {
  const records = await session.client.getDevices(); const result = [];
  for (const record of records.filter(r => r.deviceClass === 'camera' || /^T8210/i.test(r.model))) {
    const device = await session.client.getDevice(record.sn); const info = device.info?.(); const battery = device.battery?.()?.level;
    result.push({ sn: record.sn, name: info?.name || record.name || 'Sonnette', model: info?.model || record.model, homebase: records.find(r => r.sn === record.stationSn)?.model || null, battery: typeof battery === 'number' && Number.isFinite(battery) && battery >= 0 && battery <= 100 ? battery : null, capabilities: device.capabilities.filter(c => ['camera', 'battery', 'doorbell', 'motion', 'personDetection'].includes(c)), storedImage: typeof device.camera?.()?.snapshotStored === 'function', liveAvailable: typeof device.camera?.()?.live === 'function' });
  }
  session.channels = await session.client.waitForRealtime({ timeoutMs: 100 });
  session.devices = result; session.lastRead = Date.now(); session.selected = result.some(d => d.sn === session.selected) ? session.selected : result.find(d => /^T8210/i.test(d.model))?.sn || result[0]?.sn || null;
}
async function applyLogin(session, result) {
  session.captcha = undefined;
  if (result.status === LoginStatus.Captcha) { session.phase = 'captcha'; session.captcha = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.image) ? result.image : undefined; return; }
  if (result.status === LoginStatus.TwoFactor) { session.phase = '2fa'; return; }
  if (result.status !== LoginStatus.Ok) throw new Error('Login rejected');
  session.options.password = ''; session.options.email = ''; session.phase = 'connected'; session.message = undefined;
  await roster(session);
}
function publicStatus(s) { return s ? { phase: s.phase, devices: s.devices, selected: s.selected, events: s.events, captcha: s.captcha, message: s.pushRegistration === 'failed' ? 'Les alertes automatiques sont indisponibles : Eufy refuse leur inscription.' : s.message, readAt: s.lastRead, channels: s.channels, pushRegistration: s.pushRegistration, channelErrors: s.channelErrors || [] } : { phase: 'disconnected', devices: [], selected: null, events: [], readAt: null }; }
async function body(req) { let size = 0; const parts = []; for await (const part of req) { size += part.length; if (size > 8192) throw new Error('Body too large'); parts.push(part); } return JSON.parse(Buffer.concat(parts).toString('utf8')); }
function reply(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
function validId(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
export function createServer() { return http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.headers['x-domoryx-eufy'] !== '1') return reply(res, 403, { error: 'Accès refusé.' });
  if (req.method !== 'GET' && req.method !== 'POST') return reply(res, 405, { error: 'Méthode refusée.' });
  if (req.method === 'POST') { let origin; try { origin = new URL(req.headers.origin).host; } catch {} if (origin !== req.headers.host || !req.headers['content-type']?.startsWith('application/json')) return reply(res, 403, { error: 'Origine refusée.' }); }
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)domoryx_eufy=([a-f0-9]{64})(?:;|$)/); let id = match?.[1]; let session = id ? sessions.get(id) : undefined;
  try {
    if (!session && validId(id) && storeFor(id).load()) {
      session = connectSession(id); makeClient(session); session.busy = true;
      try { await applyLogin(session, await session.client.login()); } catch { session.phase = 'reauth_required'; session.message = 'Reconnecte ton compte Eufy.'; } finally { session.busy = false; }
    }
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/api/eufy/status' && req.method === 'GET') {
      if (session?.phase === 'connected' && !session.busy && Date.now() - session.lastRead > 60000) { session.busy = true; try { await roster(session); session.message = undefined; } catch { session.message = 'Actualisation Eufy indisponible. Dernières données conservées.'; } finally { session.busy = false; } }
      if (session?.phase === 'connected') session.channels = await session.client.waitForRealtime({ timeoutMs: 10 });
      return reply(res, 200, publicStatus(session));
    }
    if (path === '/api/eufy/login' && req.method === 'POST') {
      if (session?.busy || Date.now() - lastLogin < 5000) return reply(res, 429, { error: 'Patiente quelques secondes avant de réessayer.' });
      const input = await body(req); if (typeof input.email !== 'string' || !input.email.includes('@') || typeof input.password !== 'string' || !input.password) return reply(res, 400, { error: 'Renseigne ton e-mail et ton mot de passe Eufy.' });
      lastLogin = Date.now(); if (session) { await session.client?.disconnect(); storeFor(session.id).clear(); session.options.pushStore.clear(); sessions.delete(session.id); }
      id = randomBytes(32).toString('hex'); session = connectSession(id); makeClient(session, input.email.trim(), input.password); input.password = ''; session.busy = true;
      res.setHeader('Set-Cookie', `${cookieName}=${id}; Path=/api/eufy; HttpOnly; SameSite=Strict; Max-Age=${TTL / 1000}${req.headers.origin?.startsWith('https:') ? '; Secure' : ''}`);
      try { await applyLogin(session, await session.client.login()); } catch { session.options.password = ''; session.options.email = ''; session.phase = 'disconnected'; session.message = 'Connexion Eufy refusée ou temporairement indisponible. Vérifie tes identifiants.'; await session.client.disconnect(); storeFor(id).clear(); } finally { session.busy = false; }
      return reply(res, 200, publicStatus(session));
    }
    if (!session) return reply(res, 401, { error: 'Connecte ton compte Eufy.' });
    if (session.busy) return reply(res, 409, { error: 'Une demande Eufy est déjà en cours.' });
    if ((path === '/api/eufy/verify' || path === '/api/eufy/captcha') && req.method === 'POST') {
      const input = await body(req); if (typeof input.code !== 'string' || input.code.length < 1 || input.code.length > 12) return reply(res, 400, { error: 'Code invalide.' });
      const isCaptcha = path.endsWith('/captcha'); if (session.phase !== (isCaptcha ? 'captcha' : '2fa')) return reply(res, 409, { error: 'Cette étape de connexion a expiré.' });
      session.busy = true;
      try { await applyLogin(session, await (isCaptcha ? session.client.solveCaptcha(input.code) : session.client.submitVerifyCode(input.code))); } catch { session.message = 'Code refusé ou service Eufy indisponible. Réessaie avec le code reçu.'; } finally { session.busy = false; }
      return reply(res, 200, publicStatus(session));
    }
    if (path === '/api/eufy/select' && req.method === 'POST') { const input = await body(req); if (!session.devices.some(d => d.sn === input.sn)) return reply(res, 400, { error: 'Sonnette absente de ce compte.' }); session.selected = input.sn; return reply(res, 200, publicStatus(session)); }
    if (path === '/api/eufy/live' && req.method === 'GET') {
      if (session.phase !== 'connected' || !session.selected) return reply(res, 409, { error: 'Aucune sonnette connectée.' });
      session.live?.stop?.();
      const lease = {}; session.live = lease;
      const controller = new AbortController(); let recording; let timer;
      const stop = () => { controller.abort(); recording?.stop(); };
      lease.stop = () => { stop(); if (!res.destroyed) res.end(); };
      res.once('close', stop);
      try {
        const device = await session.client.getDevice(session.selected); const cam = device.camera?.();
        if (controller.signal.aborted || res.destroyed) return;
        if (!cam?.recordFragments) throw new Error('Unsupported media');
        recording = cam.recordFragments({ fragmentSeconds: 1, preBufferSeconds: 0, signal: controller.signal });
        timer = setTimeout(stop, 22000);
        for await (const fragment of recording) {
          if (controller.signal.aborted || res.destroyed) break;
          if (fragment.init && !res.headersSent) {
            const box = fragment.init.indexOf('avcC');
            if (box < 0) throw new Error('Unsupported codec');
            const codec = 'avc1.' + fragment.init.subarray(box + 5, box + 8).toString('hex');
            const audio = fragment.init.indexOf('mp4a') >= 0 ? ',mp4a.40.2' : '';
            res.writeHead(200, { 'Content-Type': `video/mp4; codecs="${codec}${audio}"`, 'X-Accel-Buffering': 'no' });
            clearTimeout(timer); timer = setTimeout(stop, 60000);
            if (!res.write(fragment.init)) await once(res, 'drain', { signal: controller.signal });
          }
          if (fragment.data.length && !res.destroyed && !res.write(smoothVideoFragment(fragment.data))) await once(res, 'drain', { signal: controller.signal });
        }
        if (!res.headersSent && !res.destroyed) reply(res, 504, { error: 'La sonnette n’a pas envoyé de vidéo. Réessaie dans quelques instants.' });
        else if (!res.destroyed) res.end();
      } catch {
        if (!res.headersSent && !res.destroyed) reply(res, 503, { error: 'La vidéo Eufy est indisponible pour le moment.' });
        else if (!res.destroyed) res.end();
      } finally { clearTimeout(timer); stop(); if (session.live === lease) session.live = undefined; res.off('close', stop); }
      return;
    }
    if (path === '/api/eufy/image' && req.method === 'GET') {
      if (session.phase !== 'connected' || !session.selected) return reply(res, 409, { error: 'Aucune sonnette connectée.' });
      try { const device = await session.client.getDevice(session.selected); const jpeg = await device.camera?.()?.snapshotStored?.(); if (!jpeg?.length) throw new Error(); res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(jpeg); } catch { reply(res, 404, { error: 'Aucune image reçue. Une image pourra apparaître après une détection.' }); } return;
    }
    if (path === '/api/eufy/logout' && req.method === 'POST') { await session.client?.disconnect(); session.options.password = ''; session.options.email = ''; storeFor(session.id).clear(); session.options.pushStore.clear(); sessions.delete(session.id); res.setHeader('Set-Cookie', `${cookieName}=; Path=/api/eufy; HttpOnly; SameSite=Strict; Max-Age=0`); return reply(res, 200, publicStatus()); }
    return reply(res, 404, { error: 'Page inconnue.' });
  } catch { return reply(res, 503, { error: 'Service Eufy momentanément indisponible.' }); }
}); }
const cleanup = setInterval(() => { for (const [id, s] of sessions) if (Date.now() - s.created > (['2fa', 'captcha'].includes(s.phase) ? 600000 : TTL)) { if (s.options) { s.options.password = ''; s.options.email = ''; } void s.client?.disconnect(); sessions.delete(id); storeFor(id).clear(); } }, 60000); cleanup.unref();
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) { const server = createServer(); server.listen(Number(process.env.DOMORYX_EUFY_PORT || 8767), '127.0.0.1', () => process.stdout.write('Service Eufy Domoryx prêt sur 127.0.0.1:8767\n')); for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { for (const session of sessions.values()) void session.client?.disconnect(); server.close(); setTimeout(() => process.exit(0), 1000).unref(); }); }
