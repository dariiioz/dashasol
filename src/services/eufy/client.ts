export interface EufyDevice { sn: string; name: string; model: string; homebase: string | null; battery: number | null; capabilities: string[]; storedImage: boolean; liveAvailable: boolean }
export interface EufyEvent { id: string; kind: 'doorbellPress' | 'motion' | 'personDetected'; deviceSn: string; receivedAt: number }
export interface EufyChannels { state: string; push: { required: number; ready: number; failed: number; pending: number }; mqtt: { required: number; ready: number; failed: number; pending: number }; wiredP2p: { required: number; ready: number; failed: number; pending: number } }
export interface EufyStatus { pushRegistration?: 'registered' | 'failed'; channels?: EufyChannels; channelErrors?: string[]; phase: 'disconnected' | 'connected' | '2fa' | 'captcha' | 'reauth_required'; devices: EufyDevice[]; selected: string | null; events: EufyEvent[]; captcha?: string; message?: string; readAt: number | null }
export const initialEufy: EufyStatus = { phase: 'disconnected', devices: [], selected: null, events: [], readAt: null };
export const eufyHeaders = { 'X-Domoryx-Eufy': '1' };
export class EufyError extends Error { constructor(message: string, readonly serviceUnavailable = false) { super(message); } }
export async function eufyRequest(path: 'status' | 'login' | 'verify' | 'captcha' | 'select' | 'logout', body?: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(`/api/eufy/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: signal ?? AbortSignal.timeout(90000), headers: { ...eufyHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) throw new EufyError(typeof data?.error === 'string' ? data.error : 'Le service Eufy est indisponible.', !data || typeof data !== 'object');
  if (!data || !['disconnected', 'connected', '2fa', 'captcha', 'reauth_required'].includes(data.phase) || !Array.isArray(data.devices) || !Array.isArray(data.events)) throw new EufyError('Réponse du service Eufy invalide.', true);
  return data as EufyStatus;
}
export const eufyEventLabel = (kind: EufyEvent['kind']) => ({ doorbellPress: 'Quelqu’un a sonné', motion: 'Mouvement détecté', personDetected: 'Personne détectée' }[kind]);
