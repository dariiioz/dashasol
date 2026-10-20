import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Moon, Sun } from 'lucide-react';
import { useScreensaverStore } from '../stores/screensaverStore';
import { useAppStore } from '../stores/appStore';
import { useClock } from '../hooks/useClock';
import { useWeather } from '../hooks/useWeather';
import { weatherCondition } from '../services/weather/client';
import { weatherLabel } from '../utils/entities';
import { WeatherScene } from '../features/weather/WeatherScene';
import { defaultWall } from '../utils/preferences';
import { useDialogFocus } from '../hooks/useDialogFocus';
import './screensaver.css';

export function ScreensaverHost() {
  const configured = useAppStore(s => s.configured);
  const seconds = useAppStore(s => s.preferences.wall?.screensaverSeconds ?? defaultWall.screensaverSeconds);
  const active = useScreensaverStore(s => s.active);
  useEffect(() => {
    if (!configured || active || !seconds) return;
    let lastActivity = Date.now();
    const check = () => { if (Date.now() - lastActivity >= seconds * 1000) useScreensaverStore.getState().activate(); };
    const reset = () => { lastActivity = Date.now(); };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    const interval = window.setInterval(check, 1000);
    window.addEventListener('pointerdown', reset, true); window.addEventListener('keydown', reset, true); window.addEventListener('wheel', reset, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(interval); window.removeEventListener('pointerdown', reset, true); window.removeEventListener('keydown', reset, true); window.removeEventListener('wheel', reset, true); document.removeEventListener('visibilitychange', visible); };
  }, [configured, active, seconds]);
  return configured && active ? createPortal(<Screensaver />, document.body) : null;
}
function Screensaver() {
  const now = useClock(); const dialog = useDialogFocus(); const container = useRef<HTMLDivElement>(null);
  const hour12 = useAppStore(s => s.preferences.hour12); const demo = useAppStore(s => s.demo);
  const reducedMotion = useAppStore(s => s.preferences.reducedMotion);
  const [unlocking, setUnlocking] = useState(false);
  useEffect(() => {
    if (!unlocking) return;
    const timeout = window.setTimeout(() => useScreensaverStore.getState().dismiss(), reducedMotion ? 0 : 300);
    return () => window.clearTimeout(timeout);
  }, [unlocking, reducedMotion]);
  const demoWeather = useAppStore(s => s.entities[s.mapping.weather ?? '']);
  const weather = useWeather(!demo); const current = weather.forecast?.current;
  const condition = demo ? demoWeather?.state : current ? weatherCondition(current.code, current.day) : undefined;
  const value = demo ? Number(demoWeather?.attributes.temperature) : current?.temperature;
  const phase = current && !demo ? current.day ? 'day' : 'night' : now.getHours() >= 7 && now.getHours() < 20 ? 'day' : 'night';
  const Icon = condition === 'sunny' ? Sun : condition === 'clear-night' ? Moon : Cloud;
  useEffect(() => {
    const previous = new Map<HTMLElement, boolean>();
    const hide = () => { for (const element of document.body.children) if (element instanceof HTMLElement && element !== container.current && !previous.has(element)) { previous.set(element, element.inert); element.inert = true; } };
    hide(); const observer = new MutationObserver(hide); observer.observe(document.body, { childList: true });
    return () => { observer.disconnect(); for (const [element, inert] of previous) element.inert = inert; };
  }, []);
  return <div className="privacy-screen" ref={container} data-sky={phase}>
    <WeatherScene condition={condition} phase={phase} windSpeed={current?.wind ?? undefined} reducedMotion={reducedMotion} />
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="Écran de veille" tabIndex={-1} className="privacy-content">
      <span className="privacy-brand">DOMORYX</span>
      <p className="privacy-date">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <time className="privacy-clock">{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12 })}</time>
      <div className="privacy-weather"><Icon size={32} strokeWidth={1.4} /><strong>{value != null && Number.isFinite(value) ? `${Math.round(value)}°` : '—°'}</strong><span>{condition ? weatherLabel(condition) : 'Météo indisponible'}</span></div>
      <button className="privacy-dismiss" aria-label="Déverrouiller l’écran" aria-disabled={unlocking} data-unlocking={unlocking} data-reduced-motion={reducedMotion} onClick={() => setUnlocking(true)}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="privacy-lock-shackle" d="M7 11V7a5 5 0 0 1 10 0v4" /><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M12 15v2" /></svg></button>
    </section>
  </div>;
}
