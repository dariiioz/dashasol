import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useClock } from '../../hooks/useClock';
import { useEntityName } from '../../hooks/useEntityName';
import type { HassEntity, RoomConfig } from '../../types/homeAssistant';
import { selectedIds } from '../../utils/dashboard';
import { degreeUnit, freshness, numberState, temperature, unavailable } from '../../utils/entities';
/** A wall display is read at a glance, never scrolled: rooms are laid out in full screens you swipe through. */
const useRoomsPerPage = () => { const [perPage, setPerPage] = useState(6); useEffect(() => { const wide = window.matchMedia('(min-width:901px)'); const medium = window.matchMedia('(min-width:621px)'); const apply = () => setPerPage(wide.matches ? 6 : medium.matches ? 4 : 2); apply(); wide.addEventListener('change', apply); medium.addEventListener('change', apply); return () => { wide.removeEventListener('change', apply); medium.removeEventListener('change', apply); }; }, []); return perPage; };
export function TemperaturesPage() {
  const rooms = useAppStore(s => s.rooms); const entities = useAppStore(s => s.entities); const selections = useAppStore(s => s.dashboard.temperatureEntities); const showUnavailable = useAppStore(s => s.preferences.showUnavailable);
  const name = useEntityName(); const now = useClock(); const perPage = useRoomsPerPage(); const scroller = useRef<HTMLDivElement>(null); const [page, setPage] = useState(0);
  const display: RoomConfig[] = rooms.length ? rooms : selectedIds(selections).map((id, order) => ({ id, name: name(entities[id] ?? id), temperature: id, order }));
  const visible = display.filter(room => showUnavailable || !unavailable(entities[room.temperature ?? ''])).sort((a, b) => a.order - b.order);
  const pages = useMemo(() => Array.from({ length: Math.max(1, Math.ceil(visible.length / perPage)) }, (_, index) => visible.slice(index * perPage, index * perPage + perPage)), [perPage, visible]);
  useEffect(() => { if (page > pages.length - 1) { setPage(0); scroller.current?.scrollTo({ left: 0 }); } }, [page, pages.length]);
  const goTo = (index: number) => { setPage(index); scroller.current?.scrollTo({ left: index * (scroller.current?.clientWidth ?? 0), behavior: 'smooth' }); };
  return <section className="page temperatures-page"><header className="page-heading"><div><p className="eyebrow">Confort intérieur</p><h1>La température, <em>pièce par pièce.</em></h1></div>{visible.length > 0 && <p className="muted">{visible.length} pièce{visible.length > 1 ? 's' : ''} suivie{visible.length > 1 ? 's' : ''}</p>}</header>
    {visible.length ? <><div className="thermal-pages" ref={scroller} onScroll={event => { const width = event.currentTarget.clientWidth; if (width) setPage(Math.round(event.currentTarget.scrollLeft / width)); }}>{pages.map((group, index) => <div className="thermal-page" key={index}>{group.map((room, position) => <RoomCard key={room.id} room={room} entity={entities[room.temperature ?? '']} humidity={entities[room.humidity ?? '']} now={now} delay={position * .04} />)}</div>)}</div>
      {pages.length > 1 && <div className="pagination" aria-label="Pages de températures">{pages.map((_, index) => <button key={index} aria-label={`Page ${index + 1}`} aria-current={index === page ? 'page' : undefined} className={index === page ? 'active' : ''} onClick={() => goTo(index)} />)}</div>}</> : <p className="empty">Ajoutez vos capteurs de température dans Réglages.</p>}
  </section>;
}
function RoomCard({ room, entity, humidity, now, delay }: { room: RoomConfig; entity?: HassEntity; humidity?: HassEntity; now: Date; delay: number }) {
  const value = numberState(entity); const missing = unavailable(entity);
  /** 14 °C to 28 °C covers what a home actually does; anything beyond simply pins the gauge. */
  const heat = Math.max(4, Math.min(100, ((value ?? 14) - 14) / 14 * 100));
  return <motion.article className={`thermal-card ${missing ? 'unavailable' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .3 }}>
    <div className="thermal-card-top"><p>{room.name}</p>{humidity && <span className="humidity"><Droplets size={13} /> {humidity.state}%</span>}</div>
    <strong>{temperature(value, degreeUnit(entity))}</strong>
    <div><div className="thermal-gauge" style={{ '--heat': `${heat}%` } as React.CSSProperties}><i /></div><small>{missing ? 'Mesure indisponible' : freshness(entity, now)}</small></div>
  </motion.article>;
}
