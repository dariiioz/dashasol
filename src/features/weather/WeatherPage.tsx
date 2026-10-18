import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CloudRain, Droplets, Eye, Gauge, MapPin, RefreshCw, Sun, Sunrise, Sunset, Wind } from 'lucide-react';
import { useWeather } from '../../hooks/useWeather';
import { useClock } from '../../hooks/useClock';
import { useAppStore } from '../../stores/appStore';
import { formatValue as f, localDate, localTime, location, weatherCondition, weatherText, type Reading } from '../../services/weather/client';
import { WeatherIcon } from './WeatherIcon';
import { WeatherScene } from './WeatherScene';
import { cardinal, uvLevel } from './metrics';
type Metric = 'temperature' | 'probability' | 'wind';
function useCompactWeather() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width:620px), (max-height:650px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width:620px), (max-height:650px)');
    const update = () => setCompact(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}
export function WeatherPage() {
  const demo = useAppStore(s => s.demo); const reducedMotion = useAppStore(s => s.preferences.reducedMotion);
  const { forecast, air, loading, error, airError, refresh } = useWeather(!demo);
  const now = useClock(); const [selected, setSelected] = useState<number>(); const [metric, setMetric] = useState<Metric>('temperature');
  const compact = useCompactWeather(); const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0); const pageRef = useRef(page); pageRef.current = page;
  const screenNames = compact ? ['Actuel', 'Détails', '10 jours', 'Heures', 'Air'] : ['Maintenant', 'Prévisions', 'Air'];
  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(screenNames.length - 1, index));
    setPage(next); scroller.current?.scrollTo({ left: next * scroller.current.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    setPage(0); scroller.current?.scrollTo({ left: 0 });
  }, [compact]);
  useEffect(() => {
    const element = scroller.current; if (!element) return;
    const observer = new ResizeObserver(() => element.scrollTo({ left: pageRef.current * element.clientWidth }));
    observer.observe(element); return () => observer.disconnect();
  }, [Boolean(forecast), demo]);
  if (demo) return <section className="page weather-page"><div className="weather-empty"><Sun size={40} /><p>La météo de Marquise sera disponible après la connexion à votre maison.</p><span>Le mode démo ne contacte aucun service externe.</span></div></section>;
  if (!forecast) return <section className="page weather-page"><div className="weather-empty" role="status"><CloudRain size={40} /><p>{loading ? 'Chargement de la météo de Marquise…' : error ?? 'Météo indisponible.'}</p><button className="weather-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={17} />Réessayer</button></div></section>;
  const current = forecast.current; const todayKey = localDate(now.getTime(), {});
  const days = forecast.days;
  const day = days.find(d => d.time === selected) ?? days.find(d => localDate(d.time, {}) === todayKey) ?? days[0];
  const hours = forecast.hours.filter(hour => day && localDate(hour.time, {}) === localDate(day.time, {}));
  const upcoming = forecast.hours.filter(hour => hour.time >= now.getTime()).slice(0, 12);
  const rain = upcoming.find(hour => (hour.rain ?? 0) >= .1);
  const stale = now.getTime() - forecast.fetchedAt > 30 * 60_000;
  const today = days.find(d => localDate(d.time, {}) === todayKey) ?? days[0];
  const currentHour = forecast.hours.find(h => h.time <= now.getTime() && h.time + 3_600_000 > now.getTime());
  const aqiLabel = air?.aqi == null ? 'Indisponible' : air.aqi <= 20 ? 'Bon' : air.aqi <= 40 ? 'Correct' : air.aqi <= 60 ? 'Modéré' : air.aqi <= 80 ? 'Mauvais' : air.aqi <= 100 ? 'Très mauvais' : 'Extrêmement mauvais';
  const details = <div className="weather-details"><MetricCard icon={<Wind size={20} />} label="Vent" value={f(current.wind, ' km/h')} detail={`${cardinal(current.direction ?? undefined) ?? '—'} · rafales ${f(current.gust, ' km/h')}`} /><MetricCard icon={<Droplets size={20} />} label="Humidité" value={f(current.humidity, ' %')} detail={`Pluie actuelle ${f(current.rain, ' mm', 1)}`} /><MetricCard icon={<Sun size={20} />} label="UV" value={f(currentHour?.uv)} detail={`Maximum ${f(today?.uv, '', 1)} · ${uvLevel(today?.uv ?? undefined)?.label ?? '—'}`} /><MetricCard icon={<Gauge size={20} />} label="Pression" value={f(current.pressure, ' hPa')} detail={`Nuages ${f(current.cloud, ' %')}`} /><MetricCard icon={<Eye size={20} />} label="Visibilité" value={f(currentHour?.visibility == null ? null : currentHour.visibility / 1000, ' km', 1)} detail="Estimation du modèle" /><MetricCard icon={<Sunrise size={20} />} label="Soleil" value={localTime(today?.sunrise)} detail={<>{localTime(today?.sunset)} <Sunset size={13} /> · {f(today?.sunshine == null ? null : today.sunshine / 3600, ' h', 1)} de soleil</>} /></div>;
  const daysView = <div className="weather-days" aria-label="Prévisions sur 10 jours">{days.map((d, i) => <button key={d.time} className={day?.time === d.time ? 'selected' : ''} aria-pressed={day?.time === d.time} onClick={() => { setSelected(d.time); if (compact) goTo(3); }} aria-label={`${localDate(d.time, { weekday: 'long', day: 'numeric', month: 'long' })}, ${weatherText(d.code)}, ${f(d.min, '°')} à ${f(d.max, '°')}`}><span>{localDate(d.time, {}) === todayKey ? 'Aujourd’hui' : localDate(d.time, { weekday: 'short' })}</span><small>{localDate(d.time, { day: 'numeric', month: 'short' })}</small><WeatherIcon code={d.code} /><b>{f(d.max, '°')} <small>{f(d.min, '°')}</small></b><span className="weather-day-rain"><Droplets size={12} />{f(d.probability, ' %')}</span>{i > 6 && <small className="weather-trend">Tendance</small>}</button>)}</div>;
  const hourlyView = <div className="weather-hourly"><div className="weather-chart-toolbar"><span>{day && localDate(day.time, { weekday: 'long', day: 'numeric', month: 'long' })}</span><div role="group" aria-label="Donnée des prévisions horaires">{([['temperature', 'Température'], ['probability', 'Pluie'], ['wind', 'Vent']] as const).map(([id, label]) => <button key={id} aria-pressed={metric === id} className={metric === id ? 'selected' : ''} onClick={() => setMetric(id)}>{label}</button>)}</div></div><HourlyChart hours={hours} metric={metric} /><div className="weather-hours">{hours.map(hour => <div key={hour.time}><span>{localTime(hour.time)}</span><WeatherIcon code={hour.code} day={hour.day} /><b>{f(hour.temperature, '°')}</b><small className="weather-hour-rain">{f(hour.probability, ' %')} · {f(hour.rain, ' mm', 1)}</small><small>{f(hour.wind, ' km/h')} {cardinal(hour.direction ?? undefined)}</small></div>)}</div>{day && <div className="weather-day-summary"><span><CloudRain size={15} />{f(day.rain, ' mm', 1)} sur la journée</span><span><Wind size={15} />Rafales jusqu’à {f(day.gust, ' km/h')}</span><span><Sunrise size={15} />{localTime(day.sunrise)}</span><span><Sunset size={15} />{localTime(day.sunset)}</span></div>}</div>;
  return <section className="page weather-page">
    <div className="weather-toolbar"><span><MapPin size={16} />{location.name} · 62250</span><div><span>Actualisé à {localTime(forecast.fetchedAt)}</span><button className="weather-refresh" aria-label="Actualiser la météo" disabled={loading} onClick={() => void refresh()}><RefreshCw className={loading ? 'spin' : ''} size={17} /></button></div></div>
    {(error || stale) && <p className="weather-notice" role="status">{error ?? 'Les données météo datent de plus de 30 minutes.'} Dernières prévisions conservées · {localDate(forecast.fetchedAt, { day: 'numeric', month: 'short' })} à {localTime(forecast.fetchedAt)}.</p>}
    <div className="weather-screens" ref={scroller} onScroll={event => { const width = event.currentTarget.clientWidth; if (width) setPage(Math.round(event.currentTarget.scrollLeft / width)); }}>
    <div className="weather-screen weather-overview-screen" role="group" aria-label="Conditions actuelles"><div className="weather-overview"><div className="weather-now" data-sky={current.day ? 'day' : 'night'}><WeatherScene condition={weatherCondition(current.code, current.day)} phase={current.day ? 'day' : 'night'} windSpeed={current.wind ?? undefined} reducedMotion={reducedMotion} /><div className="weather-now-content"><div className="weather-current-icon"><WeatherIcon code={current.code} day={current.day} size={50} /><span>{weatherText(current.code, current.day)}</span></div><strong>{f(current.temperature, '°')}</strong><p>Ressenti {f(current.feels, '°')} <span><ArrowDown size={13} />{f(today?.min, '°')} <ArrowUp size={13} />{f(today?.max, '°')}</span></p><div className="weather-rain-summary"><CloudRain size={18} />{(current.rain ?? 0) > 0 ? `Pluie en cours · ${f(current.rain, ' mm', 1)}` : rain ? `Pluie prévue vers ${localTime(rain.time)} · ${f(rain.probability, ' %')}` : upcoming.length && upcoming.every(hour => hour.rain !== null && hour.probability !== null) ? 'Pas de pluie significative prévue dans les 12 h' : 'Prévisions de pluie indisponibles'}</div></div></div>
      {!compact && details}
    </div>
    </div>
    {compact && <div className="weather-screen weather-details-screen" role="group" aria-label="Détails météo">{details}</div>}
    {compact ? <><div className="weather-screen weather-days-screen" role="group" aria-label="Prévisions sur dix jours">{daysView}</div><div className="weather-screen weather-hourly-screen" role="group" aria-label="Prévisions heure par heure">{hourlyView}</div></> : <div className="weather-screen weather-forecast-screen" role="group" aria-label="Prévisions météo">{daysView}{hourlyView}</div>}
    <div className="weather-screen weather-air-screen" role="group" aria-label="Qualité de l’air et pollens"><div className="weather-air"><div><Wind size={22} /><span>Air · indice européen</span><strong>{aqiLabel}{air?.aqi != null && <small> {f(air.aqi)}</small>}</strong><small>{air ? `Modèle CAMS · ${localTime(air.time)}` : airError ?? 'Chargement…'}</small>{airError && air && <small>{airError} Dernières valeurs conservées.</small>}</div><div className="weather-air-values"><span>PM2,5<b>{f(air?.pm25, ' µg/m³', 1)}</b></span><span>PM10<b>{f(air?.pm10, ' µg/m³', 1)}</b></span><span>Ozone<b>{f(air?.ozone, ' µg/m³', 1)}</b></span><span>Graminées<b>{f(air?.grass, ' grains/m³')}</b></span><span>Bouleau<b>{f(air?.birch, ' grains/m³')}</b></span><span>Aulne<b>{f(air?.alder, ' grains/m³')}</b></span></div></div>
    </div></div>
    <nav className="weather-pagination" aria-label="Pages météo"><button aria-label="Page météo précédente" disabled={page === 0} onClick={() => goTo(page - 1)}><ChevronLeft size={19} /></button><div>{screenNames.map((name, index) => <button key={name} aria-label={name} aria-current={page === index ? 'page' : undefined} className={page === index ? 'active' : ''} onClick={() => goTo(index)}><i />{name}</button>)}</div><button aria-label="Page météo suivante" disabled={page === screenNames.length - 1} onClick={() => goTo(page + 1)}><ChevronRight size={19} /></button></nav>
    <footer className="weather-attribution">Prévisions de modèles · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Air : <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS / Copernicus</a> · Rafraîchissement toutes les 15 min. <a href="https://vigilance.meteofrance.fr/fr/pas-de-calais" target="_blank" rel="noreferrer">Vigilance officielle ↗</a></footer>
  </section>;
}
function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: React.ReactNode }) { return <div className="weather-metric-card"><span>{icon}{label}</span><b>{value}</b><small>{detail}</small></div>; }
function HourlyChart({ hours, metric }: { hours: Reading[]; metric: Metric }) {
  const unit = metric === 'temperature' ? '°C' : metric === 'probability' ? '%' : 'km/h';
  const values = hours.map(h => h[metric]); const valid = values.filter((v): v is number => v !== null);
  if (!valid.length) return <p className="muted">Prévisions horaires indisponibles.</p>;
  const min = metric === 'temperature' ? Math.floor(Math.min(...valid) - 2) : 0; const max = metric === 'probability' ? 100 : Math.ceil(Math.max(...valid) + 2); const span = Math.max(1, max - min);
  const x = (i: number) => 40 + i / Math.max(1, hours.length - 1) * 920; const y = (v: number) => 150 - (v - min) / span * 120;
  const path = values.map((v, i) => v === null ? '' : `${i === 0 || values[i - 1] === null ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  return <svg className={`weather-chart ${metric}`} viewBox="0 0 1000 185" role="img" aria-label={`${metric === 'temperature' ? 'Température' : metric === 'probability' ? 'Probabilité de pluie' : 'Vitesse du vent'} heure par heure, de ${f(Math.min(...valid))} à ${f(Math.max(...valid))} ${unit}`}>
    {[0, .5, 1].map(t => <g key={t}><line x1="40" x2="960" y1={y(min + t * span)} y2={y(min + t * span)} /><text x="6" y={y(min + t * span) + 4}>{Math.round(min + t * span)}</text></g>)}<path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />{hours.map((h, i) => i % 3 === 0 && <text key={h.time} x={x(i)} y="177" textAnchor="middle">{localTime(h.time)}</text>)}
  </svg>;
}
