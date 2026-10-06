import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Power, Thermometer } from 'lucide-react';
import { callHomeAssistantService } from '../../hooks/useHomeAssistant';
import { useAppStore } from '../../stores/appStore';
import { useEntityName } from '../../hooks/useEntityName';
import type { HassEntity } from '../../types/homeAssistant';
import { selectedIds } from '../../utils/dashboard';
import { degreeUnit, numberState, temperature, unavailable } from '../../utils/entities';
export function HeatingPage() { const climateSelections = useAppStore(s => s.dashboard?.climateEntities); const entities = useAppStore(s => s.entities); const showUnavailable = useAppStore(s => s.preferences.showUnavailable); const ids = useMemo(() => selectedIds(climateSelections).filter(id => showUnavailable || !unavailable(entities[id])), [climateSelections, entities, showUnavailable]); const demo = useAppStore(s => s.demo); const update = useAppStore(s => s.updateEntity); const notify = useAppStore(s => s.notify); const setPage = useAppStore(s => s.setPage); const name = useEntityName(); return <section className="page heating-page"><header className="page-heading"><div><p className="eyebrow">Climat intérieur</p><h1>Le chauffage, <em>à la juste chaleur.</em></h1></div></header><div className="climate-list">{ids.map(id => <ClimateControl key={id} entity={entities[id]} name={name(entities[id] ?? id)} demo={demo} update={update} notify={notify} />)}</div>{ids.length === 0 && <div className="empty-state"><p>Aucun chauffage n’est encore sélectionné.</p><button onClick={() => setPage('settings')}>Sélectionner mes chauffages</button></div>}</section>; }
type Props = { entity?: HassEntity; name: string; demo: boolean; update: ReturnType<typeof useAppStore.getState>['updateEntity']; notify: ReturnType<typeof useAppStore.getState>['notify'] };
function ClimateControl({ entity, ...props }: Props) { if (!entity || unavailable(entity)) return <article className="climate-control unavailable"><span>{props.name} · Indisponible</span></article>; return <ActiveClimateControl entity={entity} {...props} />; }
function ActiveClimateControl({ entity, name, demo, update, notify }: Props & { entity: HassEntity }) {
  const connection = useAppStore(s => s.connection);
  const current = numberState({ ...entity, state: String(entity.attributes.current_temperature ?? entity.state) });
  const rawTarget = Number(entity.attributes.temperature);
  const target = Number.isFinite(rawTarget) ? rawTarget : 20;
  const [draft, setDraft] = useState(target);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const committed = useRef(target);
  useEffect(() => { setDraft(target); committed.current = target; }, [target]);
  const active = entity.state !== 'off';
  const min = Number(entity.attributes.min_temp); const max = Number(entity.attributes.max_temp);
  const lower = Number.isFinite(min) ? min : 7; const upper = Number.isFinite(max) ? max : 30;
  const rawStep = Number(entity.attributes.target_temp_step);
  const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : .5;
  const disabled = pending || (!demo && connection !== 'connected');
  const send = async (service: string, value?: number) => {
    if (inFlight.current || (!demo && connection !== 'connected')) return;
    const previous = committed.current;
    if (value !== undefined) { if (value === previous) return; committed.current = value; setDraft(value); }
    inFlight.current = true; setPending(true);
    try {
      if (demo) update({ ...entity, state: service === 'turn_off' ? 'off' : service === 'turn_on' ? 'heat' : entity.state, attributes: { ...entity.attributes, ...(value !== undefined ? { temperature: value } : {}), ...(service === 'turn_off' ? { hvac_action: 'off' } : {}) } });
      else await callHomeAssistantService('climate', service, value === undefined ? {} : { temperature: value }, { entity_id: entity.entity_id });
      notify({ kind: 'success', text: value === undefined ? 'Commande de chauffage envoyée.' : `Consigne envoyée : ${value.toFixed(1)}°` });
    } catch (error) {
      committed.current = previous; setDraft(previous);
      notify({ kind: 'error', text: error instanceof Error ? error.message : 'La consigne n’a pas pu être envoyée.' });
    } finally { inFlight.current = false; setPending(false); }
  };
  const commit = () => void send('set_temperature', draft);
  return <article className="climate-control" aria-busy={pending}>
    <div className="climate-top"><div><p>{name}</p><span className={active && entity.attributes.hvac_action === 'heating' ? 'heating-active' : ''}>{pending ? 'Envoi…' : !demo && connection !== 'connected' ? 'Hors connexion' : !active ? 'Éteint' : entity.attributes.hvac_action === 'heating' ? <><Flame size={14} /> Chauffe</> : 'En régulation'}</span></div>
      <button className="icon-button" disabled={disabled} aria-label={`${active ? 'Éteindre' : 'Allumer'} ${name}`} aria-pressed={active} onClick={() => void send(active ? 'turn_off' : 'turn_on')}><Power size={17} /></button></div>
    <div className="climate-current"><Thermometer size={17} /><b>{temperature(current, degreeUnit(entity))}</b><small>mesurée</small></div>
    <div className="temperature-scale"><div><span>Consigne</span><output>{draft.toFixed(1)}°</output></div>
      <button disabled={disabled || draft <= lower} aria-label={`Diminuer la consigne ${name}`} onClick={() => void send('set_temperature', Math.max(lower, Number((draft - step).toFixed(2))))}>−</button>
      <input disabled={disabled} aria-label={`Consigne ${name}`} aria-valuetext={`${draft.toFixed(1)} degrés`} type="range" min={lower} max={upper} step={step} value={draft} onChange={e => setDraft(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} onPointerCancel={() => setDraft(committed.current)} />
      <button disabled={disabled || draft >= upper} aria-label={`Augmenter la consigne ${name}`} onClick={() => void send('set_temperature', Math.min(upper, Number((draft + step).toFixed(2))))}>+</button>
    </div>
  </article>;
}
