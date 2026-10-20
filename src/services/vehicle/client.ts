export type VehiclePhase = 'disconnected' | 'otp_required' | 'connected' | 'reauth_required' | 'consent_required';
export interface VehicleData {
  vin: string; battery: number | null; range: number | null; target: number | null; batteryTemperature: number | null;
  chargingState: string | null; power: number | null; chargeRate: number | null; remainingMinutes: number | null;
  chargeType: string | null; plug: string | null; plugLock: string | null; externalPower: string | null;
  odometer: number | null; inspectionDays: number | null; inspectionKm: number | null;
  reportedAt: string | null; chargingReportedAt: string | null; plugReportedAt: string | null; odometerReportedAt: string | null; fetchedAt: number;
}
export interface VehicleSession { phase: VehiclePhase; vehicles: { vin: string; name: string }[]; selectedVin: string | null; data: VehicleData | null; message?: string; consentUrl?: string; pollSeconds: number }
export const disconnected: VehicleSession = { phase: 'disconnected', vehicles: [], selectedVin: null, data: null, pollSeconds: 300 };
export class VehicleError extends Error { constructor(message: string, readonly status: number, readonly phase?: VehiclePhase, readonly consentUrl?: string, readonly serviceUnavailable = false) { super(message); } }
export async function vehicleRequest(path: 'status' | 'login' | 'otp' | 'data' | 'select' | 'logout' | 'resume', body?: Record<string, string>, signal?: AbortSignal): Promise<VehicleSession> {
  const response = await fetch(`/api/vehicle/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: signal ?? AbortSignal.timeout(165_000), headers: { 'X-Domoryx-Vehicle': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new VehicleError(typeof payload?.error === 'string' ? payload.error : 'Le service véhicule est indisponible. Vérifiez que le service local Domoryx est démarré.', response.status, ['consent_required', 'reauth_required'].includes(payload?.phase) ? payload.phase : undefined, consentLink(payload?.consentUrl), !payload || typeof payload !== 'object');
  if (!payload || !['disconnected', 'otp_required', 'connected', 'reauth_required', 'consent_required'].includes(payload.phase) || !Array.isArray(payload.vehicles)) throw new VehicleError('Réponse du service véhicule invalide.', 502, undefined, undefined, true);
  return payload as VehicleSession;
}
export function chargeLabel(state: string | null | undefined) {
  if (!state) return 'État indisponible';
  return ({ charging: 'En recharge', readyForCharging: 'Prête à charger', notReadyForCharging: 'Pas en recharge', chargePurposeReachedAndNotConservationCharging: 'Recharge terminée', chargePurposeReachedAndConservation: 'Recharge terminée', conservation: 'Maintien de charge', chargingOff: 'Pas en recharge', off: 'Pas en recharge', error: 'Erreur de recharge', unsupported: 'Indisponible' } as Record<string, string>)[state] ?? 'État non reconnu';
}
export function plugLabel(state: string | null | undefined) { return state === 'connected' ? 'Branchée' : state === 'disconnected' ? 'Débranchée' : 'Indisponible'; }
export function duration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';
  const rounded = Math.round(minutes); return rounded >= 60 ? `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')}` : `${rounded} min`;
}
export function reportAge(stamp: string | null | undefined, now: number) {
  const time = stamp ? Date.parse(stamp) : NaN;
  return { known: Number.isFinite(time), stale: !Number.isFinite(time) || now - time > 30 * 60_000, label: Number.isFinite(time) ? new Date(time).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date du relevé non fournie' };
}

export function consentLink(value: unknown): string | undefined {
 if (typeof value !== 'string') return undefined;
 try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'identity.vwgroup.io' && url.pathname === '/v2/login/ui/consent' && !url.username && !url.password ? value : undefined; } catch { return undefined; }
}
