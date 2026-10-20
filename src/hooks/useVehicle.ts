import { useCallback, useEffect, useRef, useState } from 'react';
import { VehicleError, disconnected, vehicleRequest, type VehicleSession } from '../services/vehicle/client';
export function useVehicle(enabled = true) {
  const [session, setSession] = useState<VehicleSession>(disconnected); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const [serviceAvailable, setServiceAvailable] = useState<boolean>();
  const mounted = useRef(false); const working = useRef(false);
  const run = useCallback(async (path: Parameters<typeof vehicleRequest>[0], body?: Record<string, string>) => {
    if (working.current) return false;
    working.current = true; setBusy(true); setError(undefined);
    try {
      let next = await vehicleRequest(path, body);
      if (mounted.current) setServiceAvailable(true);
      if (mounted.current) setSession(next);
      if (next.phase === 'connected' && next.selectedVin && path !== 'data' && path !== 'logout') next = await vehicleRequest('data');
      if (mounted.current) setSession(next);
      return true;
    } catch (failure) {
      if (mounted.current) {
        setServiceAvailable(failure instanceof VehicleError && !failure.serviceUnavailable);
        setError(failure instanceof Error ? failure.message : 'Connexion Volkswagen indisponible.');
        if (failure instanceof VehicleError && failure.phase) setSession(previous => ({ ...previous, phase: failure.phase!, message: failure.message, consentUrl: failure.consentUrl }));
      }
      return false;
    }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (enabled) void run('status');
    return () => { mounted.current = false; };
  }, [enabled, run]);
  useEffect(() => {
    if (!enabled || session.phase !== 'connected' || !session.selectedVin) return;
    const update = () => { if (document.visibilityState === 'visible') void run('data'); };
    const timer = window.setInterval(update, 60_000); window.addEventListener('online', update); document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [enabled, run, session.phase, session.selectedVin]);
  return { session, busy, error, serviceAvailable, retry: () => run('status'), login: (email: string, password: string) => run('login', { email, password }), otp: (code: string) => run('otp', { code }), refresh: () => run('data'), resume: () => run('resume', {}), select: (vin: string) => run('select', { vin }), logout: () => run('logout', {}) };
}
