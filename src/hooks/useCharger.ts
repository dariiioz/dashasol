import { useEffect, useState } from 'react';
export interface ChargerData { state: string; power: number | null; energy: number | null; temperature: number | null; currentLimit: number | null; maximumCurrent: number | null; phases: { name: string; voltage: number | null; current: number | null }[]; hasAlarm: boolean; readAt: number }
export interface ChargeSession { id: string; start: number; end: number | null; lastSeen: number; energyKwh: number; peakKw: number; partial: boolean; segments: { time: number; kwh: number }[] }
export interface ChargeHistory { startedAt: number; active: ChargeSession | null; sessions: ChargeSession[] }
export interface ChargerStatus { configured: boolean; online: boolean; data: ChargerData | null; message?: string; history?: ChargeHistory }
export function useCharger(enabled: boolean) {
  const [status, setStatus] = useState<ChargerStatus>();
  useEffect(() => {
    if (!enabled) { setStatus(undefined); return; }
    let stopped = false; let busy = false; let controller: AbortController | undefined;
    const read = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true; controller = new AbortController(); const timeout = window.setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch('/api/vehicle/charger', { headers: { 'X-Domoryx-Vehicle': '1' }, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const next = await response.json() as ChargerStatus;
        if (typeof next.configured !== 'boolean' || typeof next.online !== 'boolean') throw new Error('Invalid response');
        if (!stopped) setStatus(next);
      } catch { if (!stopped) setStatus(previous => ({ ...previous, configured: previous?.configured ?? true, online: false, data: previous?.data ?? null, message: 'Connexion locale à la borne indisponible.' })); }
      finally { clearTimeout(timeout); busy = false; }
    };
    void read(); const timer = window.setInterval(read, 15000); document.addEventListener('visibilitychange', read); window.addEventListener('online', read);
    return () => { stopped = true; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', read); window.removeEventListener('online', read); };
  }, [enabled]);
  return status;
}
export const chargerLabel = (state: string | undefined) => ({ idle: 'Au repos', sleep: 'En veille', plugged: 'Véhicule branché', charging: 'En recharge', waiting: 'En attente', fault: 'Défaut de recharge', paused: 'En pause', finished: 'Recharge terminée' }[state ?? ''] ?? 'État non fourni');
