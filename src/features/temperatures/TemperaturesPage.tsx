import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useTemperatureHistory } from '../../hooks/useTemperatureHistory';
import type { HistoryPoint } from '../../services/home-assistant/history';
import { TemperatureChart } from './TemperatureChart';
import { useClock } from '../../hooks/useClock';
import { useEntityName } from '../../hooks/useEntityName';
import type { HassEntity, RoomConfig } from '../../types/homeAssistant';
import { humidityId, householdRoomName } from '../../utils/household';
import { selectedIds } from '../../utils/dashboard';
import { degreeUnit, freshness, numberState, temperature, unavailable } from '../../utils/entities';
/** A wall display is read at a glance, never scrolled: rooms are laid out in full screens you swipe through. */
const useRoomsPerPage = () => { const [perPage, setPerPage] = useState(6); useEffect(() => { const wide = window.matchMedia('(min-width:1101px)'); const medium = window.matchMedia('(min-width:621px)'); const apply = () => setPerPage(wide.matches ? 6 : medium.matches ? 4 : 2); apply(); wide.addEventListener('change', apply); medium.addEventListener('change', apply); return () => { wide.removeEventListener('change', apply); medium.removeEventListener('change', apply); }; }, []); return perPage; };
export function TemperaturesPage() {
  const rooms = useAppStore(s => s.rooms); const entities = useAppStore(s => s.entities); const selections = useAppStore(s => s.dashboard.temperatureEntities); const showUnavailable = useAppStore(s => s.preferences.showUnavailable);
  const name = useEntityName(); const now = useClock(); const perPage = useRoomsPerPage(); const scroller = useRef<HTMLDivElement>(null); const [page, setPage] = useState(0);
  const chosen = selectedIds(selections);
  const display: RoomConfig[] = rooms.length ? rooms.filter(room => !room.hidden && room.temperature && chosen.includes(room.temperature)).map(room => ({ ...room, name: useAppStore.getState().labels[room.temperature!] || room.name })) : chosen.map((id, order) => ({ id, name: useAppStore.getState().labels[id] || householdRoomName(id, name(entities[id] ?? id)), temperature: id, order }));
  const visible = display.filter(room => showUnavailable || !unavailable(entities[room.temperature ?? ''])).sort((a, b) => a.order - b.order);
  const pages = useMemo(() => Array.from({ length: Math.max(1, Math.ceil(visible.length / perPage)) }, (_, index) => visible.slice(index * perPage, index * perPage + perPage)), [perPage, visible]);
  useEffect(() => { if (page > pages.length - 1) { setPage(0); scroller.current?.scrollTo({ left: 0 }); } }, [page, pages.length]);
  const [hours, setHours] = useState(24);
  const [metric, setMetric] = useState<'temperature' | 'humidity'>('temperature');
  for (const room of visible) if (!room.humidity) room.humidity = humidityId(room.temperature);
  const history = useTemperatureHistory(visible.flatMap(room => { const id = metric === 'humidity' ? room.humidity : room.temperature; return id && entities[id] ? [id] : []; }), hours);
  const demo = useAppStore(s => s.demo);
  const goTo = (index: number) => { setPage(index); scroller.current?.scrollTo({ left: index * (scroller.current?.clientWidth ?? 0), behavior: useAppStore.getState().preferences.reducedMotion ? 'auto' : 'smooth' }); };
  return <section className="page temperatures-page"><header className="page-heading"><div><p className="eyebrow">Confort intérieur</p><h1>La température, <em>pièce par pièce.</em></h1></div>{visible.length > 0 && <p className="muted">{visible.length} pièce{visible.length > 1 ? 's' : ''} suivie{visible.length > 1 ? 's' : ''}</p>}</header>
    {visible.length > 0 && <><div className="history-toolbar"><div className="history-periods" role="group" aria-label="Mesure affichée"><button aria-pressed={metric === 'temperature'} className={metric === 'temperature' ? 'selected' : ''} onClick={() => setMetric('temperature')}>Température</button><button aria-pressed={metric === 'humidity'} className={metric === 'humidity' ? 'selected' : ''} onClick={() => setMetric('humidity')}>Humidité</button></div><div className="history-periods" role="group" aria-label="Période de l’historique">{[{ hours: 6, label: '6 h' }, { hours: 24, label: '24 h' }, { hours: 168, label: '7 jours' }].map(period => <button key={period.hours} className={hours === period.hours ? 'selected' : ''} aria-pressed={hours === period.hours} onClick={() => setHours(period.hours)}>{period.label}</button>)}</div><button className="history-refresh" aria-label="Actualiser les historiques" disabled={history.status === 'loading'} onClick={history.reload}><RefreshCw size={16} className={history.status === 'loading' ? 'spin' : ''} /> Actualiser</button></div><p className="history-note">{demo ? 'Courbes simulées · mode démonstration' : 'Mesures enregistrées par Home Assistant · actualisation toutes les 5 min'}</p></>}
    {history.status === 'error' && visible.length > 0 && <div className="history-error" role="status"><p>{history.error}</p><span>Vérifiez que l’historique est activé et que ces capteurs sont enregistrés dans Home Assistant.</span></div>}
    {visible.length ? <><div className="thermal-pages" ref={scroller} onScroll={event => { const width = event.currentTarget.clientWidth; if (width) setPage(Math.round(event.currentTarget.scrollLeft / width)); }}>{pages.map((group, index) => <div className="thermal-page" key={index}>{group.map((room, position) => <RoomCard key={room.id} room={room} entity={entities[room.temperature ?? '']} humidity={entities[room.humidity ?? '']} now={now} delay={position * .04} history={history.data[(metric === 'humidity' ? room.humidity : room.temperature) ?? ''] ?? []} metric={metric} start={history.start} end={history.end} loading={history.status === 'loading'} />)}</div>)}</div>
      {pages.length > 1 && <div className="pagination" aria-label="Pages de températures">{pages.map((_, index) => <button key={index} aria-label={`Page ${index + 1}`} aria-current={index === page ? 'page' : undefined} className={index === page ? 'active' : ''} onClick={() => goTo(index)} />)}</div>}</> : <p className="empty">Ajoutez vos capteurs de température dans Réglages.</p>}
  </section>;
}
function RoomCard({ room, entity, humidity, now, delay, history, start, end, loading, metric }: { metric: 'temperature' | 'humidity'; room: RoomConfig; entity?: HassEntity; humidity?: HassEntity; now: Date; delay: number; history: HistoryPoint[]; start: number; end: number; loading: boolean }) {
  const plotted = metric === 'humidity' ? humidity : entity;
  const value = numberState(plotted); const missing = unavailable(plotted);
  const humidityValue = numberState(humidity);
  const base = room.humidity?.replace(/_humidity$/, '');
  const entities = useAppStore(s => s.entities);
  const min = numberState(entities[`number.${base?.split('.')[1]}_comfort_humidity_min`]);
  const max = numberState(entities[`number.${base?.split('.')[1]}_comfort_humidity_max`]);
  const comfort = humidityValue === undefined ? undefined : min !== undefined && humidityValue < min ? 'Sous votre seuil d’humidité' : max !== undefined && humidityValue > max ? 'Au-dessus de votre seuil d’humidité' : min !== undefined && max !== undefined ? 'Humidité dans vos seuils' : undefined;
  const stamp = Date.parse(plotted?.last_updated ?? '');
  const points = useMemo(() => {
    const points = [...history];
    if (points.length && Number.isFinite(stamp) && stamp >= start && stamp <= end && stamp > points[points.length - 1].time) points.push({ time: stamp, value: missing ? null : value ?? null });
    return points;
  }, [history, stamp, start, end, missing, value]);

  return <motion.article className={`thermal-card ${missing ? 'unavailable' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .3 }}>
    <div className="thermal-card-top"><p>{room.name}</p>{humidity && <span className="humidity"><Droplets size={13} /> {humidityValue === undefined ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(humidityValue)} %`}</span>}</div>
    <div className="thermal-now"><strong>{metric === 'humidity' ? value === undefined ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %` : temperature(missing ? undefined : value, degreeUnit(entity))}</strong><span>maintenant</span></div>
    <TemperatureChart points={points} start={start} end={end} unit={metric === 'humidity' ? '%' : degreeUnit(entity)} formatValue={metric === 'humidity' ? value => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %` : undefined} name={room.name} loading={loading} />
    {comfort && <span className="comfort-note">{comfort}</span>}<small>{missing ? 'Mesure indisponible' : freshness(plotted, now)}</small>
  </motion.article>;
}
