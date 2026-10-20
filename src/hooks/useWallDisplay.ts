import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { defaultWall } from '../utils/preferences';
import { create } from 'zustand';
export const useWallStatus = create<{ status: 'off' | 'active' | 'unavailable' | 'paused' }>(() => ({ status: 'off' }));
export function isNightTime(now: Date, start: string, end: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start === end) return false;
  const minutes = (value: string) => +value.slice(0, 2) * 60 + +value.slice(3);
  const time = now.getHours() * 60 + now.getMinutes(); const from = minutes(start); const to = minutes(end);
  return from < to ? time >= from && time < to : time >= from || time < to;
}
export function useWallDisplay() {
  const saved = useAppStore(s => s.preferences.wall); const settings = { ...defaultWall, ...saved };
  const [night, setNight] = useState(false); const [pausedUntil, setPausedUntil] = useState(0);
  const [wakeStatus, setWakeStatus] = useState<'off' | 'active' | 'unavailable' | 'paused'>('off');
  useEffect(() => {
    const update = () => setNight(settings.nightMode && Date.now() >= pausedUntil && isNightTime(new Date(), settings.nightStart, settings.nightEnd));
    update(); const timer = setInterval(update, 30000); document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [settings.nightMode, settings.nightStart, settings.nightEnd, pausedUntil]);
  useEffect(() => {
    if (!settings.keepAwake) { setWakeStatus('off'); return; }
    if (!window.isSecureContext || !navigator.wakeLock) { setWakeStatus('unavailable'); return; }
    let stopped = false; let lock: WakeLockSentinel | undefined; let requesting = false;
    const request = async () => {
      if (stopped || requesting || lock && !lock.released || document.visibilityState === 'hidden') return;
      requesting = true;
      try { const next = await navigator.wakeLock.request('screen'); if (stopped) { await next.release(); return; } lock = next; setWakeStatus('active'); next.addEventListener('release', () => { if (!stopped) setWakeStatus('paused'); }); }
      catch { if (!stopped) setWakeStatus('unavailable'); }
      finally { requesting = false; }
    };
    const visibility = () => { if (document.visibilityState === 'visible') void request(); };
    void request(); document.addEventListener('visibilitychange', visibility); window.addEventListener('domoryx-wake-retry', visibility);
    return () => { stopped = true; void lock?.release().catch(() => {}); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('domoryx-wake-retry', visibility); };
  }, [settings.keepAwake]);
  useEffect(() => { document.documentElement.dataset.night = String(night); document.documentElement.dataset.wake = wakeStatus; useWallStatus.setState({ status: wakeStatus }); }, [night, wakeStatus]);
  return { night, wakeStatus, pauseNight: () => setPausedUntil(Date.now() + 10 * 60_000) };
}
