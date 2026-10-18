import { useCallback, useEffect, useRef, useState } from 'react';
import { eufyRequest, initialEufy } from '../services/eufy/client';
export function useEufy(enabled = true, intervalMs = 5000) {
  const [status, setStatus] = useState(initialEufy); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false); const mounted = useRef(false); const working = useRef(false);
  const run = useCallback(async (path: Parameters<typeof eufyRequest>[0], body?: Record<string, string>) => {
    if (working.current) return false; working.current = true;
    if (path !== 'status') setBusy(true);
    try { const next = await eufyRequest(path, body); if (mounted.current) { setStatus(next); setError(undefined); } return next.phase === 'connected'; }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Connexion Eufy indisponible.'); return false; }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }, []);
  useEffect(() => { mounted.current = true; if (enabled) void run('status'); return () => { mounted.current = false; }; }, [enabled, run]);
  useEffect(() => { if (!enabled) return; const read = () => { if (document.visibilityState === 'visible') void run('status'); }; const timer = setInterval(read, intervalMs); document.addEventListener('visibilitychange', read); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', read); }; }, [enabled, run, intervalMs]);
  return { status, error, busy, run };
}
