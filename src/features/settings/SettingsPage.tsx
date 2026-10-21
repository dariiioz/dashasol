import { WallSettings } from './WallSettings';
import { ServiceDiagnostics } from './ServiceDiagnostics';
import { HomeAssistantConnection } from './HomeAssistantConnection';
import { CoverCommandSettings } from './CoverCommandSettings';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck, Copy, Eraser, ExternalLink, Loader2, LogIn, LogOut, Moon, RotateCcw, Search, ShieldCheck, Sparkles, Sun, Tag, TriangleAlert, Wifi } from 'lucide-react';
import { StatusPill } from '../../components/StatusPill';
import { useAppStore } from '../../stores/appStore';
import { useEntityName } from '../../hooks/useEntityName';
import { forgetSpotifySession } from '../../hooks/useSpotify';
import { assistantClient } from '../../hooks/useVoiceAssistant';
import { defaultAssistantModel } from '../../stores/config';
import { configuredClientId, loopbackReady, redirectUri, startAuthorization } from '../../services/spotify/auth';
import type { EntitySelection, HassEntity, Page } from '../../types/homeAssistant';
import { dashboardIds } from '../../utils/preferences';
import { confirmAction } from '../../stores/confirmationStore';
import { normalizeEntityIds } from '../../utils/dashboard';
import { isPowerSensor } from '../../utils/power';
import { domainOf, labelOf } from '../../utils/entities';

type Category = 'temperatureEntities' | 'climateEntities' | 'coverEntities' | 'mediaEntities' | 'updateEntities';
const labels: Record<Category, string> = { temperatureEntities: 'Températures', climateEntities: 'Chauffage', coverEntities: 'Volets', mediaEntities: 'Musique', updateEntities: 'Mises à jour' };
const startupPages: { value: Page; label: string }[] = [{ value: 'household', label: 'Votre maison' }, { value: 'home', label: 'Accueil' }, { value: 'energy', label: 'Énergie' }, { value: 'weather', label: 'Météo' }, { value: 'vehicle', label: 'ID.4' }, { value: 'entry', label: 'Entrée' }, { value: 'planner', label: 'Agenda' }, { value: 'temperatures', label: 'Températures' }, { value: 'heating', label: 'Chauffage' }, { value: 'covers', label: 'Volets' }, { value: 'media', label: 'Musique' }];
const autoHomeChoices = [{ value: 0, label: 'Jamais' }, { value: 60, label: 'Après 1 min' }, { value: 180, label: 'Après 3 min' }, { value: 300, label: 'Après 5 min' }];
const fits = (id: string, attributes: Record<string, unknown>, category: Category) => category === 'temperatureEntities' ? (domainOf(id) === 'sensor' && (attributes.device_class === 'temperature' || ['°C', '°F'].includes(String(attributes.unit_of_measurement)))) : domainOf(id) === ({ climateEntities: 'climate', coverEntities: 'cover', mediaEntities: 'media_player', updateEntities: 'update' }[category]);
const settingsSections = [
  { id: 'display', label: 'Écran' }, { id: 'equipment', label: 'Équipements' },
  { id: 'services', label: 'Connexions' }, { id: 'system', label: 'Système' }
] as const;
type SettingsSection = typeof settingsSections[number]['id'];
export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>('display');
  const config = useAppStore(s => s.config); const demo = useAppStore(s => s.demo);
  const reset = useAppStore(s => s.reset); const pref = useAppStore(s => s.preferences);
  const setPreferences = useAppStore(s => s.setPreferences); const entities = useAppStore(s => s.entities);
  const dashboard = useAppStore(s => s.dashboard); const setDashboard = useAppStore(s => s.setDashboard);
  const lastSync = useAppStore(s => s.lastSync); const registries = useAppStore(s => s.registries);
  const setPage = useAppStore(s => s.setPage);
  return <section className="page settings-page">
    <header className="settings-header"><h2>Réglages</h2><StatusPill /></header>
    <div className="settings-tabs" role="tablist" aria-label="Rubriques des réglages" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = settingsSections.findIndex(item => item.id === section);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? settingsSections.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + settingsSections.length) % settingsSections.length;
      setSection(settingsSections[next].id);
      (event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
    }}>{settingsSections.map(item => <button key={item.id} id={`settings-tab-${item.id}`} role="tab" tabIndex={section === item.id ? 0 : -1} aria-selected={section === item.id} aria-controls={`settings-panel-${item.id}`} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>
    <div key={section} className="settings-panel" role="tabpanel" id={`settings-panel-${section}`} aria-labelledby={`settings-tab-${section}`}>
      {section === 'display' && <div className="settings-cards">
        <section className="settings-card"><h3>Apparence</h3><div className="settings-buttons"><button className={pref.theme === 'dark' ? 'selected' : ''} aria-pressed={pref.theme === 'dark'} onClick={() => setPreferences({ theme: 'dark' })}><Moon size={17} />Sombre</button><button className={pref.theme === 'light' ? 'selected' : ''} aria-pressed={pref.theme === 'light'} onClick={() => setPreferences({ theme: 'light' })}><Sun size={17} />Clair</button><button className={pref.theme === 'auto' ? 'selected' : ''} aria-pressed={pref.theme === 'auto'} onClick={() => setPreferences({ theme: 'auto' })}>Auto</button></div>
        <label className="toggle"><span>Réduire les mouvements</span><input type="checkbox" checked={pref.reducedMotion} onChange={e => setPreferences({ reducedMotion: e.target.checked })} /></label>
        <label className="toggle"><span>Horloge sur 12 heures</span><input type="checkbox" checked={pref.hour12} onChange={e => setPreferences({ hour12: e.target.checked })} /></label></section>
        <section className="settings-card"><h3>Écran mural</h3><div className="settings-selects"><label>Page au démarrage<select value={pref.startupPage} onChange={e => setPreferences({ startupPage: e.target.value as Page })}>{startupPages.map(page => <option key={page.value} value={page.value}>{page.label}</option>)}</select></label><label>Retour à l’accueil<select value={pref.autoHomeSeconds} onChange={e => setPreferences({ autoHomeSeconds: Number(e.target.value) })}>{autoHomeChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label></div></section>
        <WallSettings /><section className="settings-card"><h3>Commandes et disponibilité</h3><label className="toggle"><span>Confirmer les actions globales</span><input type="checkbox" checked={pref.confirmGlobalActions} onChange={e => setPreferences({ confirmGlobalActions: e.target.checked })} /></label><label className="toggle"><span>Afficher les équipements indisponibles</span><input type="checkbox" checked={pref.showUnavailable} onChange={e => setPreferences({ showUnavailable: e.target.checked })} /></label></section>
      </div>}
      {section === 'equipment' && <><section className="entity-settings"><h3>Équipements affichés</h3>{(Object.keys(labels) as Category[]).map(category => <EntityPicker key={category} title={labels[category]} category={category} entities={entities} values={dashboard[category]} onChange={values => setDashboard({ ...dashboard, [category]: values })} />)}</section>
        <details className="settings-fold"><summary>Électricité et commandes rapides</summary><div className="settings-card"><PowerSettings /><CoverCommandSettings /></div></details>
        <details className="settings-fold"><summary>Renommer les équipements</summary><LabelSettings /></details></>}
      {section === 'services' && <><ServiceDiagnostics /><section className="settings-card"><h3>Home Assistant</h3><div className="settings-row"><Wifi size={18} /><div><b>{demo ? 'Mode démonstration' : config?.homeName ?? 'Ma maison'}</b><small>{demo ? 'Maison de démonstration' : config?.url}</small></div><StatusPill /></div><HomeAssistantConnection /></section>
        <div className="settings-service-links"><button onClick={() => setPage('vehicle')}>Volkswagen <span>Gérer le compte ID.4 →</span></button><button onClick={() => setPage('entry')}>Sonnette Eufy <span>Gérer la connexion →</span></button></div>
        <details className="settings-fold"><summary>Spotify</summary><SpotifySettings /></details><details className="settings-fold"><summary>Assistant vocal</summary><AssistantSettings /></details>
        <section className="settings-card settings-automatic"><h3>Météo</h3><span>Marquise · automatique</span></section></>}
      {section === 'system' && <><section className="settings-card"><h3>Informations</h3><dl><div><dt>Dernière synchronisation</dt><dd>{lastSync ? new Date(lastSync).toLocaleString('fr-FR') : '—'}</dd></div><div><dt>Équipements découverts</dt><dd>{Object.keys(entities).length}</dd></div><div><dt>Registres</dt><dd>{registries ? `${registries.entities.length} entités` : 'En attente'}</dd></div><div><dt>Version</dt><dd>{import.meta.env.VITE_APP_VERSION || 'Développement'}</dd></div></dl></section>
        <details className="settings-fold"><summary>Sources et confidentialité</summary><div className="settings-card settings-help"><p>Les identifiants Home Assistant, Spotify et OpenRouter sont conservés sur cet appareil. L’assistant transmet votre demande et les équipements affichés à OpenRouter.</p><p>Météo : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Air : <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS / Copernicus</a></p><a href="https://vigilance.meteofrance.fr/fr/pas-de-calais" target="_blank" rel="noreferrer">Vigilance Météo-France ↗</a><a href="https://www.home-assistant.io/docs/authentication/#your-account-profile" target="_blank" rel="noreferrer">Créer un jeton Home Assistant ↗</a></div></details>
        <section className="settings-card"><h3>Réinitialiser cet écran</h3><p className="muted">Efface la connexion et les préférences de cet appareil.</p><button className="danger" onClick={async () => { if (await confirmAction({ title: 'Effacer la connexion et toutes les préférences locales ?', confirmLabel: 'Réinitialiser', danger: true })) reset(); }}><Eraser size={17} />Réinitialiser</button></section></>}
    </div>
  </section>;
}
/** OpenRouter answers browser requests directly: one key, one model id, and no server of ours in between. */
function AssistantSettings() {
  const assistant = useAppStore(s => s.assistant); const setAssistant = useAppStore(s => s.setAssistant); const notify = useAppStore(s => s.notify);
  const [key, setKey] = useState(assistant.apiKey ?? ''); const [model, setModel] = useState(assistant.model ?? defaultAssistantModel); const [testing, setTesting] = useState(false);
  const save = () => { setAssistant({ apiKey: key.trim() || undefined, model: model.trim() || defaultAssistantModel }); notify({ kind: 'success', text: 'Assistant enregistré.' }); };
  /** A key that looks right and a model that exists are two different things: only a real round trip proves the pair works. */
  const test = async () => { save(); setTesting(true); try { const reply = await assistantClient.chat([{ role: 'user', content: 'Réponds exactement : prêt.' }]); notify({ kind: 'success', text: `Modèle joignable : « ${reply.content.slice(0, 60)} »` }); } catch (failure) { notify({ kind: 'error', text: failure instanceof Error ? failure.message : 'Le modèle n’a pas répondu.' }); } finally { setTesting(false); } };
  return <section className="entity-settings"><p className="eyebrow">Assistant vocal</p><h2>OpenRouter</h2><p>Connectez un modèle pour utiliser l’assistant vocal.</p>
    <div className="spotify-settings"><label>Clé API OpenRouter<input type="password" value={key} onChange={event => setKey(event.target.value)} placeholder="sk-or-v1-…" autoComplete="off" spellCheck={false} /></label>
      <label>Modèle<input value={model} onChange={event => setModel(event.target.value)} placeholder={defaultAssistantModel} autoComplete="off" spellCheck={false} /></label>
      <label className="toggle"><span>Lire les réponses à voix haute</span><input type="checkbox" checked={assistant.voice !== false} onChange={event => setAssistant({ voice: event.target.checked })} /></label>
      <div className="global-actions"><button className="selected" onClick={save}><Sparkles size={16} /> Enregistrer</button><button disabled={!key.trim() || testing} onClick={() => void test()}>{testing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Tester le modèle</button><a className="settings-link" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Créer une clé</a></div>

    </div></section>;
}
/** Spotify is reached directly from this browser: a public Client ID, no secret, and a rotating refresh token. */
export function SpotifySettings() {
  const spotify = useAppStore(s => s.spotify); const setSpotify = useAppStore(s => s.setSpotify); const notify = useAppStore(s => s.notify);
  const [draft, setDraft] = useState(configuredClientId(spotify.clientId)); const [transfer, setTransfer] = useState(''); const connected = Boolean(spotify.refreshToken); const ready = loopbackReady();
  const connect = () => { const clientId = draft.trim(); if (!clientId) return; setSpotify({ clientId }); void startAuthorization(clientId); };
  const disconnect = () => { forgetSpotifySession(); setSpotify({ refreshToken: undefined }); notify({ kind: 'success', text: 'Compte Spotify déconnecté.' }); };
  /** The wall tablet is served over plain HTTP, where Spotify refuses to redirect: the token is authorized elsewhere, then carried here. */
  const adopt = () => { const refreshToken = transfer.trim(); if (!refreshToken) return; forgetSpotifySession(); setSpotify({ clientId: draft.trim() || spotify.clientId, refreshToken }); setTransfer(''); notify({ kind: 'success', text: 'Jeton Spotify enregistré sur cet appareil.' }); };
  return <section className="entity-settings"><p className="eyebrow">Musique</p><h2>Spotify</h2><p>Connectez votre compte Spotify pour piloter la musique.</p>
    <div className="spotify-settings"><label>Client ID de l’application<input value={draft} onChange={event => setDraft(event.target.value)} placeholder="32 caractères depuis le tableau de bord Spotify" autoComplete="off" spellCheck={false} /></label>
      <div className="global-actions">{connected ? <button onClick={disconnect}><LogOut size={16} /> Déconnecter</button> : <button className="selected" disabled={!draft.trim() || !ready} onClick={connect}><LogIn size={16} /> Connecter mon compte</button>}<a className="settings-link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Tableau de bord Spotify</a></div>
      <p className="settings-note"><ShieldCheck size={16} /> {connected ? 'Compte connecté. Le jeton de rafraîchissement reste dans le stockage local de cet appareil.' : `URI de redirection à déclarer : ${redirectUri()}`}</p>
      {!ready && <p className="settings-note warning"><TriangleAlert size={16} /><span>Spotify refuse les adresses en HTTP autres que la boucle locale. Autorisez le compte depuis <code>http://127.0.0.1:5173</code>, puis reportez le jeton ci-dessous — ou servez Domoryx en HTTPS.</span></p>}
      {connected ? <label>Jeton à reporter sur vos autres écrans<span className="token-row"><input readOnly value={spotify.refreshToken ?? ''} onFocus={event => event.currentTarget.select()} aria-label="Jeton de rafraîchissement Spotify" /><button onClick={() => { void navigator.clipboard.writeText(spotify.refreshToken ?? '').then(() => notify({ kind: 'success', text: 'Jeton copié.' })).catch(() => notify({ kind: 'error', text: 'Copie impossible. Sélectionnez le jeton pour le copier manuellement.' })); }}><Copy size={15} /></button></span></label>
        : <label>Reporter un jeton obtenu sur un autre appareil<span className="token-row"><input value={transfer} onChange={event => setTransfer(event.target.value)} placeholder="Collez ici le jeton de rafraîchissement" autoComplete="off" spellCheck={false} /><button disabled={!transfer.trim()} onClick={adopt}><ClipboardCheck size={15} /></button></span></label>}
    </div></section>;
}
/** Naming lives in one place: a label set here is used by every page, whatever the category of the entity. */
function LabelSettings() {
  const entities = useAppStore(s => s.entities); const stored = useAppStore(s => s.labels); const setLabel = useAppStore(s => s.setLabel); const dashboard = useAppStore(s => s.dashboard); const mapping = useAppStore(s => s.mapping); const [query, setQuery] = useState('');
  const used = useMemo(() => [...new Set([...dashboardIds(dashboard), ...Object.values(mapping).flatMap(value => normalizeEntityIds(value))])], [dashboard, mapping]);
  const visible = useMemo(() => { const term = query.trim().toLowerCase(); const pool = term ? Object.keys(entities).filter(id => `${id} ${labelOf(entities[id])} ${stored[id] ?? ''}`.toLowerCase().includes(term)) : [...new Set([...used, ...Object.keys(stored)])]; return pool.slice(0, 80); }, [entities, query, stored, used]);
  return <section className="entity-settings"><p className="eyebrow">Nommage</p><h2>Vos noms à vous</h2><p>Un champ vide conserve le nom Home Assistant.</p><div className="picker-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher parmi toutes les entités" aria-label="Rechercher une entité à renommer" /></div><div className="label-list">{visible.map(entityId => <LabelRow key={entityId} entityId={entityId} entity={entities[entityId]} value={stored[entityId] ?? ''} onChange={label => setLabel(entityId, label)} />)}{!visible.length && <p className="muted">Aucune entité ne correspond à cette recherche.</p>}</div></section>;
}
function LabelRow({ entityId, entity, value, onChange }: { entityId: string; entity?: HassEntity; value: string; onChange: (label: string) => void }) {
  return <div className="label-row"><span><b>{labelOf(entity) === entityId ? entityId : labelOf(entity)}</b><small>{entityId}</small></span><input value={value} placeholder={labelOf(entity)} aria-label={`Nom affiché pour ${entityId}`} onChange={e => onChange(e.target.value)} /><button aria-label={`Rétablir le nom d’origine de ${entityId}`} title="Nom d’origine" disabled={!value} onClick={() => onChange('')}><RotateCcw size={15} /></button></div>;
}
function EntityPicker({ title, category, entities, values, onChange }: { title: string; category: Category; entities: Record<string, HassEntity>; values: EntitySelection[]; onChange: (next: EntitySelection[]) => void }) { const stored = useAppStore(s => s.labels); const setLabel = useAppStore(s => s.setLabel); const name = useEntityName(); const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const candidates = useMemo(() => Object.values(entities).filter(entity => fits(entity.entity_id, entity.attributes, category)).filter(entity => `${entity.entity_id} ${labelOf(entity)}`.toLowerCase().includes(query.toLowerCase())), [category, entities, query]); const checked = new Set(values.map(value => value.entityId)); const toggle = (id: string) => onChange(checked.has(id) ? values.filter(value => value.entityId !== id) : [...values, { entityId: id, enabled: true, order: values.length }]); const reorder = (index: number, delta: number) => { const next = [...values].sort((a, b) => a.order - b.order); const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target]!, next[index]!]; onChange(next.map((value, order) => ({ ...value, order }))); }; return <article className="entity-picker"><button className="picker-heading" onClick={() => setOpen(!open)} aria-expanded={open}><span><b>{title}</b><small>{values.filter(value => value.enabled).length} sélectionnée{values.length > 1 ? 's' : ''}</small></span>{open ? <ChevronUp /> : <ChevronDown />}</button>{open && <div className="picker-body"><div className="picker-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} aria-label={`Rechercher un équipement ${title.toLowerCase()}`} placeholder={`Rechercher une entité ${title.toLowerCase()}`} /></div><div className="picker-bulk"><button onClick={() => onChange(candidates.map((entity, order) => values.find(value => value.entityId === entity.entity_id) ?? { entityId: entity.entity_id, enabled: true, order }))}>Tout sélectionner</button><button onClick={() => onChange([])}>Tout désélectionner</button></div><div className="picker-options">{candidates.map(entity => <label key={entity.entity_id}><input type="checkbox" checked={checked.has(entity.entity_id)} onChange={() => toggle(entity.entity_id)} /><span><b>{name(entity)}</b><small>{entity.state} · {entity.entity_id} · {entity.state === 'unavailable' ? 'Indisponible' : 'Disponible'}</small></span></label>)}</div>{values.length > 0 && <div className="selected-list"><p><Tag size={11} /> Nom affiché dans Domoryx</p>{[...values].sort((a, b) => a.order - b.order).map((value, index) => <div key={value.entityId}><input value={stored[value.entityId] ?? ''} placeholder={labelOf(entities[value.entityId])} aria-label={`Nom d’affichage ${value.entityId}`} onChange={e => setLabel(value.entityId, e.target.value)} /><button aria-label="Monter" onClick={() => reorder(index, -1)}>↑</button><button aria-label="Descendre" onClick={() => reorder(index, 1)}>↓</button></div>)}</div>}</div>}</article>; }

function PowerSettings() {
  const mapping = useAppStore(s => s.mapping);
  const entities = useAppStore(s => s.entities);
  const demo = useAppStore(s => s.demo);
  const name = useEntityName();
  const candidates = Object.values(entities).filter(isPowerSensor).sort((a, b) => name(a).localeCompare(name(b), 'fr'));
  const selected = mapping.power ?? (demo ? 'sensor.maison_puissance' : entities['sensor.lixee_sinsts'] ? 'sensor.lixee_sinsts' : '');
  return <div className="power-settings"><h3>Consommation électrique instantanée</h3><label>Capteur de puissance de la maison<select value={selected} onChange={event => useAppStore.getState().setPowerEntity(event.target.value)}>
    <option value="">Aucun capteur</option>{selected && !candidates.some(entity => entity.entity_id === selected) && <option value={selected}>{name(entities[selected] ?? selected)} · indisponible</option>}
    {candidates.map(entity => <option key={entity.entity_id} value={entity.entity_id}>{name(entity)} · {String(entity.attributes.unit_of_measurement)}</option>)}
  </select></label><p>Capteur en W, kW ou VA pour Linky.</p>{!candidates.length && <p>Aucun capteur compatible trouvé dans Home Assistant.</p>}</div>;
}
