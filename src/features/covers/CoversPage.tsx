import { CoverGroups } from '../household/CoverGroups';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { callHomeAssistantService } from '../../hooks/useHomeAssistant';
import { useEntityName } from '../../hooks/useEntityName';
import { unavailable } from '../../utils/entities';
import { selectedIds } from '../../utils/dashboard';
import type { HassEntity } from '../../types/homeAssistant';
/** A wall display is read at a glance, never scrolled: covers are laid out in full screens you swipe through. */
const useCoversPerPage = () => { const [perPage, setPerPage] = useState(4); useEffect(() => { const narrow = window.matchMedia('(max-width:620px)'); const apply = () => setPerPage(narrow.matches ? 2 : 4); apply(); narrow.addEventListener('change', apply); return () => narrow.removeEventListener('change', apply); }, []); return perPage; };
export function CoversPage() { const coverSelections = useAppStore(s => s.dashboard?.coverEntities); const entities = useAppStore(s => s.entities); const showUnavailable = useAppStore(s => s.preferences.showUnavailable); const ids = useMemo(() => selectedIds(coverSelections).filter(id => showUnavailable || !unavailable(entities[id])), [coverSelections, entities, showUnavailable]); const [page, setPage] = useState(0); const demo = useAppStore(s => s.demo); const update = useAppStore(s => s.updateEntity); const confirm = useAppStore(s => s.preferences.confirmGlobalActions); const notify = useAppStore(s => s.notify); const name = useEntityName(); const perPage = useCoversPerPage(); const scroller = useRef<HTMLDivElement>(null); const pages = useMemo(() => Array.from({ length: Math.max(1, Math.ceil(ids.length / perPage)) }, (_, index) => ids.slice(index * perPage, index * perPage + perPage)), [ids, perPage]); useEffect(() => { if (page > pages.length - 1) { setPage(0); scroller.current?.scrollTo({ left: 0 }); } }, [page, pages.length]); const goTo = (index: number) => { setPage(index); scroller.current?.scrollTo({ left: index * (scroller.current?.clientWidth ?? 0), behavior: useAppStore.getState().preferences.reducedMotion ? 'auto' : 'smooth' }); }; const connection = useAppStore(s => s.connection); const [sending, setSending] = useState(false); const busy = useRef(false); const availableIds = ids.filter(id => !unavailable(entities[id])); const disabled = sending || (!demo && connection !== 'connected');
 const command = async (id: string | string[], service: string, position?: number): Promise<boolean> => {
   if (busy.current) return false;
   const targets = (Array.isArray(id) ? id : [id]).filter(entityId => !unavailable(entities[entityId]));
   if (!targets.length) return false;
   busy.current = true; setSending(true);
   try {
     if (demo) targets.forEach(entityId => {
       const entity = useAppStore.getState().entities[entityId];
       const next = service === 'stop_cover' ? Number(entity.attributes.current_position ?? (entity.state === 'closed' ? 0 : 100)) : position ?? (service === 'close_cover' ? 0 : 100);
       update({ ...entity, state: next === 0 ? 'closed' : 'open', attributes: { ...entity.attributes, current_position: next } });
     });
     else await callHomeAssistantService('cover', service, position === undefined ? {} : { position }, { entity_id: targets });
     notify({ kind: 'success', text: service === 'stop_cover' ? 'Arrêt demandé.' : 'Commande envoyée.' });
     return true;
   } catch (error) { notify({ kind: 'error', text: error instanceof Error ? error.message : 'La commande a été refusée.' }); return false; }
   finally { busy.current = false; setSending(false); }
 };
 const global = (service: string) => { if (!confirm || window.confirm('Appliquer cette action à tous les volets disponibles sélectionnés ?')) void command(availableIds, service); }; return <section className="page covers-page"><header className="page-heading"><div><p className="eyebrow">Lumière & intimité</p><h1>Les volets, <em>au bon rythme.</em></h1></div><div className="global-actions"><button disabled={disabled || !availableIds.length} onClick={() => global('open_cover')}>Tout ouvrir</button><button disabled={disabled || !availableIds.length} onClick={() => global('close_cover')}>Tout fermer</button></div></header>
  <CoverGroups />{ids.length ? <><div className="cover-pages" ref={scroller} onScroll={event => { const width = event.currentTarget.clientWidth; if (width) setPage(Math.round(event.currentTarget.scrollLeft / width)); }}>{pages.map((group, index) => <div className="cover-list" key={index}>{group.map(id => <CoverControl key={id} entity={entities[id]} name={name(entities[id] ?? id)} command={command} disabled={disabled} pending={sending} />)}</div>)}</div>
    {pages.length > 1 && <div className="cover-pagination" aria-label="Pages de volets">{pages.map((_, index) => <button key={index} aria-label={`Page ${index + 1}`} aria-current={index === page ? 'page' : undefined} className={index === page ? 'active' : ''} onClick={() => goTo(index)} />)}</div>}</> : <div className="empty-state"><p>Aucun volet n’est encore sélectionné.</p><button onClick={() => useAppStore.getState().setPage('settings')}>Sélectionner mes volets</button></div>}
</section>; }
function CoverControl({ entity, name, command, disabled, pending }: { entity?: HassEntity; name: string; command: (id: string, service: string, position?: number) => Promise<boolean>; disabled: boolean; pending: boolean }) {
  const position = Number(entity?.attributes.current_position ?? (entity?.state === 'closed' ? 0 : 100));
  const [draft, setDraft] = useState(position);
  const committed = useRef(position);
  useEffect(() => { setDraft(position); committed.current = position; }, [position]);
  const unavailableEntity = unavailable(entity);
  const locked = disabled || unavailableEntity;
  const commit = async () => {
    if (!entity || locked || draft === committed.current) return;
    const previous = committed.current; committed.current = draft;
    if (!await command(entity.entity_id, 'set_cover_position', draft)) { committed.current = previous; setDraft(previous); }
  };
  const state = unavailableEntity ? 'unavailable' : draft === 0 ? 'closed' : draft === 100 ? 'open' : 'partial';
  const label = { unavailable: 'Indisponible', closed: 'Fermé', open: 'Ouvert', partial: `Entrouvert · ${draft}%` }[state];
  return <article className="cover-control" data-state={state} aria-busy={pending}><div><p>{name}</p><span className="cover-state">{pending ? 'Envoi…' : label}</span></div><div className="shutter" aria-hidden style={{ '--open': `${draft}%` } as React.CSSProperties}><i /></div>
    <div className="cover-actions"><button disabled={locked} aria-label={`Ouvrir ${name}`} title="Ouvrir" onClick={() => entity && void command(entity.entity_id, 'open_cover')}><ChevronUp size={19} /></button><button disabled={locked} aria-label={`Fermer ${name}`} title="Fermer" onClick={() => entity && void command(entity.entity_id, 'close_cover')}><ChevronDown size={19} /></button><button disabled={locked} aria-label={`Stopper ${name}`} title="Stopper" onClick={() => entity && void command(entity.entity_id, 'stop_cover')}><Pause size={16} /></button></div>
    <label className="cover-range"><SlidersHorizontal size={16} /><input disabled={locked} aria-label={`Position ${name}`} aria-valuetext={`${draft} % ouvert`} type="range" min="0" max="100" value={draft} onChange={e => setDraft(Number(e.target.value))} onPointerUp={() => void commit()} onKeyUp={() => void commit()} onBlur={() => void commit()} onPointerCancel={() => setDraft(committed.current)} /></label></article>;
}
