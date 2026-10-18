import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Cloud, CloudFog, CloudHail, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun, Wind, X, Download } from 'lucide-react';
import { tempoEntities } from '../../services/energy/model';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useWeather } from '../../hooks/useWeather';
import { weatherCondition } from '../../services/weather/client';
import { useClock } from '../../hooks/useClock';
import { useEntityName } from '../../hooks/useEntityName';
import { WeatherScene } from '../weather/WeatherScene';
import { EntryLink } from './EntryLink';
import { HomePager } from './HomePager';
import { PlannerCards } from './PlannerCards';
import { VehicleCard } from './VehicleCard';
import { PowerCard } from './PowerCard';
import { VoiceAssistant } from '../assistant/VoiceAssistant';
import { skyPhase } from '../weather/sky';
import { useAppStore } from '../../stores/appStore';
import { selectedIds } from '../../utils/dashboard';
import { degreeUnit, numberState, temperature, unavailable, weatherLabel } from '../../utils/entities';
import type { HassEntity } from '../../types/homeAssistant';
const frDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const tempoName = (state?: string) => { const key = (state ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return key.includes('bleu') ? 'Bleu' : key.includes('blanc') ? 'Blanc' : key.includes('rouge') ? 'Rouge' : 'Pas encore annoncée'; };
/** Selecting entity by entity keeps this always-on page from re-rendering on every event of the house. */
const mapped = (key: 'weather' | 'outdoorTemperature' | 'outdoorHumidity' | 'uv' | 'tempoToday' | 'tempoTomorrow') => (state: ReturnType<typeof useAppStore.getState>) => state.entities[state.mapping[key] ?? ''];
const weatherIcons: Record<string, typeof Cloud> = { sunny: Sun, 'clear-night': Moon, cloudy: Cloud, partlycloudy: CloudSun, rainy: CloudRain, pouring: CloudRain, 'lightning-rainy': CloudLightning, lightning: CloudLightning, snowy: CloudSnow, 'snowy-rainy': CloudSnow, hail: CloudHail, fog: CloudFog, windy: Wind, 'windy-variant': Wind, exceptional: Cloud };
/** `sun.sun` exists on every Home Assistant install and is never asked during onboarding: fall back to it. */
const sunEntity = (state: ReturnType<typeof useAppStore.getState>) => state.entities[state.mapping.sun || 'sun.sun'];
export function HomePage() {
  const viewport = useRef<HTMLDivElement>(null);
  const now = useClock(); const hour12 = useAppStore(s => s.preferences.hour12); const reducedMotion = useAppStore(s => s.preferences.reducedMotion); const demo = useAppStore(s => s.demo); const name = useEntityName();
  const haWeather = useAppStore(mapped('weather')); const haOutdoor = useAppStore(mapped('outdoorTemperature')); const sun = useAppStore(sunEntity); const today = useAppStore(s => tempoEntities(s.entities, s.mapping).today); const tomorrow = useAppStore(s => tempoEntities(s.entities, s.mapping).tomorrow);
  const meteo = useWeather(!demo); const live = !demo ? meteo.forecast : undefined; const current = live?.current;
  const weather: HassEntity | undefined = demo ? haWeather : current ? { entity_id: 'weather.open_meteo', state: weatherCondition(current.code, current.day), last_changed: new Date(current.time).toISOString(), last_updated: new Date(current.time).toISOString(), attributes: { temperature: current.temperature ?? undefined, humidity: current.humidity ?? undefined, wind_speed: current.wind ?? undefined, wind_speed_unit: 'km/h', wind_gust_speed: current.gust ?? undefined, wind_bearing: current.direction ?? undefined, pressure: current.pressure ?? undefined, pressure_unit: 'hPa' } } : undefined;
  const outdoor = demo ? haOutdoor : undefined; const setPage = useAppStore(s => s.setPage);
  const updates = useAppStore(useShallow(state => selectedIds(state.dashboard.updateEntities).map(id => state.entities[id]).filter((entity): entity is HassEntity => Boolean(entity) && ['on', 'true'].includes(entity.state))));
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const clock = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12 });
  const weatherTemperature = Number(weather?.attributes.temperature); const windSpeed = Number(weather?.attributes.wind_speed);
  const condition = weather?.state; const phase = current ? current.day ? 'day' : 'night' : skyPhase(sun, now); const WeatherIcon = weatherIcons[condition ?? ''] ?? (phase === 'night' ? Moon : Sun);
  return <motion.div ref={viewport} className="home-page page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><section className="hero" data-sky={phase} data-weather={condition}><WeatherScene condition={condition} phase={phase} windSpeed={Number.isFinite(windSpeed) ? windSpeed : undefined} reducedMotion={reducedMotion} /><div className="hero-time"><p>{frDate.format(now)}</p><time>{clock}</time><VoiceAssistant /></div><div className="hero-weather"><div className="weather-headline"><WeatherIcon size={34} strokeWidth={1.5} /><strong>{temperature(numberState(outdoor) ?? (Number.isFinite(weatherTemperature) ? weatherTemperature : undefined), degreeUnit(outdoor ?? weather))}</strong></div><span>{weatherLabel(condition)}</span>{!demo && <><button className="home-weather-link" onClick={() => setPage('weather')}>Marquise · Prévisions →</button>{(meteo.error || (live && now.getTime() - live.fetchedAt > 30 * 60_000)) && <small className="home-weather-error">{live ? 'Dernières prévisions conservées' : 'Météo indisponible'}</small>}</>}<EntryLink /></div></section><section className="home-grid"><div className="tempo-section" role="group" aria-label="Tempo" onClick={() => setPage('energy')}><button className="tempo-energy-link" aria-label="Voir l’énergie et Tempo" /><Tempo label="Aujourd’hui" entity={today} /><Tempo label="Demain" entity={tomorrow} /></div><VehicleCard /><div className="home-energy"><PowerCard compact /><button className="home-aside update-indicator" onClick={() => setUpdatesOpen(true)} disabled={!updates.length}><Download size={15} /><b>{updates.length ? `${updates.length} mise${updates.length > 1 ? 's' : ''} à jour` : 'À jour'}</b></button></div></section><PlannerCards /><HomePager viewport={viewport} reducedMotion={reducedMotion} />{updatesOpen && <UpdateModal updates={updates} name={name} onClose={() => setUpdatesOpen(false)} />}</motion.div>;
}
function Tempo({ label, entity }: { label: string; entity?: HassEntity }) { const name = unavailable(entity) ? 'Pas encore annoncée' : tempoName(entity?.state); const key = name.toLowerCase(); const Icon = key.includes('rouge') ? Moon : Sun; return <div className={`tempo ${key}`}><Icon size={18} /><span>{label}</span><b title={name}>{name === 'Pas encore annoncée' ? 'À confirmer' : name}</b></div>; }
function UpdateModal({ updates, name, onClose }: { updates: HassEntity[]; name: (entity?: HassEntity | string) => string; onClose: () => void }) { const dialog = useDialogFocus(); useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]); return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><motion.section ref={dialog} tabIndex={-1} className="update-modal" role="dialog" aria-modal="true" aria-label="Mises à jour disponibles" initial={{ opacity: 0, scale: .97, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Fermer"><X /></button><h2>{updates.length} mise{updates.length > 1 ? 's' : ''} à jour disponible{updates.length > 1 ? 's' : ''}</h2><div className="update-list">{updates.map(update => <article key={update.entity_id}><Download size={18} /><div><b>{name(update)}</b><span>{String(update.attributes.installed_version ?? 'Version actuelle inconnue')} → {String(update.attributes.latest_version ?? 'Nouvelle version')}</span></div>{Boolean(update.attributes.release_url) && <a href={String(update.attributes.release_url)} target="_blank" rel="noreferrer">Notes</a>}</article>)}</div></motion.section></div>; }
