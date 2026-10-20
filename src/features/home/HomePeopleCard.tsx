import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronRight, MapPin, Battery, Smartphone, Clock } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { QuickDrawer } from '../../components/QuickDrawer';
import { personDetails } from './people';
import type { HassEntity } from '../../types/homeAssistant';

const names = ['Aymeric', 'Honorine'];
const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Non renseignée';
export function HomePeopleCard() {
  const registries = useAppStore(s => s.registries);
  const candidates = useAppStore(useShallow(s => Object.values(s.entities).filter(entity => entity.entity_id.startsWith('person.'))));
  const ids = useMemo(() => {
    const sources = candidates.flatMap(person => typeof person.attributes.source === 'string' ? [person.attributes.source] : []);
    const devices = new Set(registries?.entities.filter(entry => sources.includes(String(entry.entity_id))).map(entry => entry.device_id).filter(Boolean));
    return [...new Set([...candidates.map(person => person.entity_id), ...sources, ...(registries?.entities.filter(entry => devices.has(entry.device_id)).map(entry => String(entry.entity_id)) ?? [])])];
  }, [candidates, registries]);
  const relevant = useAppStore(useShallow(s => ids.map(id => s.entities[id]).filter((entity): entity is HassEntity => Boolean(entity))));
  const entities = useMemo(() => Object.fromEntries(relevant.map(entity => [entity.entity_id, entity])), [relevant]);
  const demo = useAppStore(s => s.demo);
  const connection = useAppStore(s => s.connection);
  const dashboard = useAppStore(s => s.dashboard);
  const setDashboard = useAppStore(s => s.setDashboard);
  const [selected, setSelected] = useState<string>();
  const connected = demo || connection === 'connected';
  const people = names.map(name => personDetails(name, entities, registries, dashboard.people?.[name]));
  const person = people.find(person => person.name === selected);
  return <article className="home-people" aria-label="Aymeric et Honorine">
    {people.map(person => <button key={person.name} aria-label={`Voir les infos de ${person.name}`} aria-haspopup="dialog" onClick={() => setSelected(person.name)}>
      <span className="person-avatar" data-home={connected && person.available ? person.home : undefined}>{person.name[0]}<i /></span>
      <span className="person-summary"><b>{person.name}</b><small>{connected ? person.status : 'Hors connexion'}</small></span><ChevronRight size={14} />
    </button>)}
    {person && <QuickDrawer title={person.name} placement="bottom" onClose={() => setSelected(undefined)}>
      <div className="person-tabs" role="group" aria-label="Choisir une personne">{names.map(name => <button key={name} aria-pressed={name === selected} onClick={() => setSelected(name)}>{name}</button>)}</div>
      {!connected && <p className="person-notice" role="status">Home Assistant est déconnecté. Les dernières informations sont conservées.</p>}
      {!person.person ? <p className="person-notice">{candidates.length ? `Associe le profil Home Assistant de ${person.name} ci-dessous.` : 'Aucune personne partagée par Home Assistant. Vérifie les profils dans Réglages → Personnes de Home Assistant.'}</p> : <dl className="person-details">
        <div><dt><MapPin size={17} />Présence</dt><dd>{person.status}</dd></div>
        <div><dt><Clock size={17} />Depuis</dt><dd>{date(person.person.last_changed)}</dd></div>
        <div><dt><Clock size={17} />Dernière actualisation</dt><dd>{date(person.person.last_updated)}</dd></div>
        {person.tracker && <div><dt><Smartphone size={17} />Appareil suivi</dt><dd>{String(person.tracker.attributes.friendly_name ?? person.tracker.entity_id.replace('device_tracker.', '').replaceAll('_', ' '))}</dd></div>}
        {person.battery !== undefined && <div><dt><Battery size={17} />Batterie du téléphone</dt><dd>{person.battery} %{person.charging === true ? ' · En charge' : ''}</dd></div>}
        {person.accuracy !== undefined && <div><dt><MapPin size={17} />Précision de la position</dt><dd>± {Math.round(person.accuracy)} m</dd></div>}
      </dl>}
      {candidates.length > 0 && <details className="person-association" open={!person.person}><summary>Profil Home Assistant</summary><label>Personne associée à {person.name}<select value={dashboard.people?.[person.name] ?? ''} onChange={event => setDashboard({ ...dashboard, people: { ...dashboard.people, [person.name]: event.target.value } })}><option value="">Détection automatique</option>{candidates.map(candidate => <option key={candidate.entity_id} value={candidate.entity_id}>{String(candidate.attributes.friendly_name ?? candidate.entity_id)}</option>)}</select></label></details>}
    </QuickDrawer>}
  </article>;
}
