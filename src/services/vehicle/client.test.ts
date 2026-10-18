import { afterEach, expect, it, vi } from 'vitest';
import { chargeLabel, consentLink, duration, plugLabel, reportAge, vehicleRequest } from './client';
afterEach(() => vi.unstubAllGlobals());
it('preserves zero durations and distinguishes a missing state from a stopped car', () => {
 expect(duration(0)).toBe('0 min'); expect(duration(95)).toBe('1 h 35'); expect(duration(null)).toBe('—');
 expect(chargeLabel('charging')).toBe('En recharge'); expect(chargeLabel(null)).toBe('État indisponible'); expect(plugLabel(null)).toBe('Indisponible');
});
it('uses the vehicle report timestamp rather than the time the dashboard fetched it', () => {
 const now = Date.parse('2026-10-18T09:00:00Z'); expect(reportAge('2026-10-18T08:00:00Z', now).stale).toBe(true);
 expect(reportAge(null, now).known).toBe(false); expect(reportAge('2026-10-18T08:55:00Z', now).stale).toBe(false);
});
it('sends credentials only to the same origin bridge and never via a URL', async () => {
 const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ phase: 'otp_required', vehicles: [] }) }); vi.stubGlobal('fetch', fetch);
 await vehicleRequest('login', { email: 'test@example.org', password: 'private-test-password' });
 expect(fetch.mock.calls[0][0]).toBe('/api/vehicle/login'); const options = fetch.mock.calls[0][1]; expect(options.credentials).toBe('same-origin'); expect(options.cache).toBe('no-store'); expect(options.headers['X-Domoryx-Vehicle']).toBe('1'); expect(options.body).toContain('private-test-password');
});
it('reports a missing backend rather than treating a static fallback as vehicle data', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('HTML'); } }));
 await expect(vehicleRequest('status')).rejects.toThrow('invalide');
});

it('propagates a consent wall so the UI leaves the completed OTP challenge', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ phase: 'consent_required', error: 'Validez la demande sur myVolkswagen.' }) }));
 await expect(vehicleRequest('otp', { code: '123456' })).rejects.toMatchObject({ status: 409, phase: 'consent_required' });
});

it('does not accept arbitrary redirects as a Volkswagen consent link', () => {
 expect(consentLink('https://identity.vwgroup.io.attacker.example/v2/login/ui/consent')).toBeUndefined();
 expect(consentLink('http://identity.vwgroup.io/v2/login/ui/consent')).toBeUndefined();
 expect(consentLink('https://identity.vwgroup.io/v2/login/ui/consent?state=test')).toBeTruthy();
});
