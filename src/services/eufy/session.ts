import { create } from 'zustand';
import { eufyRequest, initialEufy, EufyError } from './client';
export const useEufySession = create<{ status: typeof initialEufy; error?: string; busy: boolean; serviceAvailable?: boolean }>(() => ({ status: initialEufy, busy: false }));
const consumers = new Map<symbol, number>();
let timer: ReturnType<typeof setTimeout> | undefined;
let reading: Promise<boolean> | undefined;
let controller: AbortController | undefined;
let commanding = false;
let failures = 0;
function schedule() {
  clearTimeout(timer);
  if (!consumers.size || document.visibilityState === 'hidden') return;
  const connected = useEufySession.getState().status.phase === 'connected';
  const delay = failures ? Math.min(60000, 10000 * 2 ** Math.min(failures - 1, 3)) : connected ? Math.max(3000, Math.min(...consumers.values())) : 30000;
  timer = setTimeout(() => { void runEufy('status'); }, delay);
}
export async function runEufy(path: Parameters<typeof eufyRequest>[0], body?: Record<string, string>): Promise<boolean> {
  if (path === 'status' && commanding) return false;
  if (path === 'status' && reading) return reading;
  if (path !== 'status') { if (commanding) return false; commanding = true; await reading; useEufySession.setState({ busy: true }); }
  const request = async () => {
    const abort = new AbortController(); if (path === 'status') controller = abort;
    const timeout = setTimeout(() => abort.abort(), path === 'status' ? 10000 : 90000);
    try { const status = await eufyRequest(path, body, abort.signal); failures = 0; useEufySession.setState({ status, error: undefined, serviceAvailable: true }); return status.phase === 'connected'; }
    catch (error) { if (!abort.signal.aborted || consumers.size) { const available = error instanceof EufyError && !error.serviceUnavailable; failures = available ? 0 : failures + 1; useEufySession.setState({ error: error instanceof Error ? error.message : 'Connexion Eufy indisponible.', serviceAvailable: available }); } return false; }
    finally { clearTimeout(timeout); if (path === 'status') { reading = undefined; controller = undefined; } else { commanding = false; useEufySession.setState({ busy: false }); } schedule(); }
  };
  if (path === 'status') { reading = request(); return reading; }
  return request();
}
const resume = () => { if (document.visibilityState !== 'hidden') void runEufy('status'); else clearTimeout(timer); };
export function subscribeEufy(interval: number) {
  const id = Symbol(); const first = !consumers.size; consumers.set(id, interval);
  if (first) { document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume); if (document.visibilityState !== 'hidden') void runEufy('status'); }
  else schedule();
  return () => { consumers.delete(id); if (!consumers.size) { clearTimeout(timer); queueMicrotask(() => { if (!consumers.size) controller?.abort(); }); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); } else schedule(); };
}
