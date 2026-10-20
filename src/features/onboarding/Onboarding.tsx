import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, FlaskConical, KeyRound, LoaderCircle, Sparkles, Wifi } from 'lucide-react';
import { HomeAssistantClient } from '../../services/home-assistant/client';
import { discoverCandidates } from '../../services/home-assistant/normalize';
import { useAppStore } from '../../stores/appStore';
import { normalizeEntityIds } from '../../utils/dashboard';
import type { EntityMapping, HassConfig, HassEntity } from '../../types/homeAssistant';

const fields: { key: keyof EntityMapping; label: string; purpose: Parameters<typeof discoverCandidates>[1] }[] = [
  { key: 'temperatures', label: 'Températures des pièces', purpose: 'temperatures' }, { key: 'climates', label: 'Chauffage', purpose: 'climates' }, { key: 'covers', label: 'Volets', purpose: 'covers' }, { key: 'mediaPlayers', label: 'Musique', purpose: 'mediaPlayers' }
];
export function Onboarding() {
  const [step, setStep] = useState(1); const [config, setConfig] = useState<HassConfig>({ homeName: 'La maison', url: '', token: '' }); const [entities, setEntities] = useState<HassEntity[]>([]); const [mapping, setMapping] = useState<EntityMapping>({}); const [diagnostic, setDiagnostic] = useState(''); const [testing, setTesting] = useState(false);
  const cancelTest = useRef<() => void>(() => {});
  useEffect(() => () => cancelTest.current(), []);
  const complete = useAppStore(s => s.completeSetup); const setStoreEntities = useAppStore(s => s.setEntities); const setStoreMapping = useAppStore(s => s.setMapping);
  function test() {
    cancelTest.current(); setTesting(true); setDiagnostic('Connexion en cours…');
    const client = new HomeAssistantClient({ ...config, url: config.url.trim(), token: config.token.trim() });
    let active = true; let unsubscribe = () => {};
    const stop = () => { active = false; window.clearTimeout(timeout); unsubscribe(); client.disconnect(); };
    const fail = (message: string) => { if (!active) return; stop(); setDiagnostic(message); setTesting(false); };
    const timeout = window.setTimeout(() => fail('Connexion impossible. Vérifiez l’URL et le jeton, puis réessayez.'), 10_000);
    cancelTest.current = stop;
    unsubscribe = client.onStatus(async (status, detail) => {
      if (!active) return;
      if (status === 'connected') {
        try {
          const all = await client.getStates(); if (!active) return;
          stop(); setEntities(all); setDiagnostic(''); setTesting(false); setStep(2);
        } catch { fail('Les équipements sont inaccessibles. Vérifiez les droits du jeton.'); }
      } else if (status === 'auth_error' || status === 'error') fail(detail ?? 'Connexion impossible.');
    });
    client.connect();
  }
  /** Multi-valued mappings keep every pick: tapping an entity adds or removes it, preserving the selection order. */
  function toggle(key: keyof EntityMapping, entityId: string) { setMapping(previous => { const current = normalizeEntityIds(previous[key]); return { ...previous, [key]: current.includes(entityId) ? current.filter(id => id !== entityId) : [...current, entityId] }; }); }
  function finish() { complete({ ...config, url: config.url.trim(), token: config.token.trim() }, false); setStoreEntities(entities); setStoreMapping(mapping); }
  return <main className="onboarding"><section className="onboarding-intro"><div className="eyebrow"><Sparkles size={16} /> Domoryx</div><h1>Votre maison,<br /><em>en clair.</em></h1><p>Connectez Home Assistant, puis choisissez les équipements de votre écran.</p><div className="steps"><span className={step >= 1 ? 'current' : ''}>01 Connexion</span><span className={step >= 2 ? 'current' : ''}>02 Équipements</span></div></section><section className="onboarding-panel">
    {step === 1 && <><div className="panel-icon"><Wifi /></div><h2>Connecter la maison</h2><p>Vos identifiants restent dans ce navigateur, uniquement sur cet appareil.</p><label>Nom de la maison<input value={config.homeName} onChange={e => setConfig({ ...config, homeName: e.target.value })} placeholder="La maison" /></label><label>URL Home Assistant<input value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} placeholder="https://homeassistant.local:8123" inputMode="url" /></label><label>Jeton d’accès longue durée <KeyRound size={14} /><input value={config.token} onChange={e => setConfig({ ...config, token: e.target.value })} placeholder="••••••••••••••••" type="password" autoComplete="off" /></label><div className="diagnostic" aria-live="polite">{diagnostic}</div><div className="actions"><button className="ghost" onClick={() => complete(undefined, true)}><FlaskConical size={17} /> Explorer la démo</button><button className="primary" disabled={!config.url.trim() || !config.token.trim() || testing} onClick={test}>{testing && <LoaderCircle className="spin" size={17} />} Tester et continuer <ArrowRight size={17} /></button></div></>}
    {step === 2 && <><div className="panel-icon"><Check /></div><h2>Choisir les équipements</h2><p>Choisissez ce que vous souhaitez afficher. Tout reste modifiable dans Réglages.</p><div className="setup-automatic"><Check size={16} /><span>Météo de Marquise déjà configurée</span></div><div className="mapping-list">{fields.map(field => { const candidates = discoverCandidates(entities, field.purpose).slice(0, 40); const label = (entity: HassEntity) => String(entity.attributes.friendly_name ?? entity.entity_id);
      const chosen = normalizeEntityIds(mapping[field.key]); return <div className="mapping-field" key={field.key}><span>{field.label}<small>{chosen.length ? `${chosen.length} sélectionné${chosen.length > 1 ? 's' : ''}` : 'Aucun'}</small></span>{candidates.length ? <div className="chip-list" role="group" aria-label={field.label}>{candidates.map(candidate => { const entityId = candidate.entity.entity_id; const active = chosen.includes(entityId); return <button type="button" key={entityId} title={entityId} className={active ? 'chip active' : 'chip'} aria-pressed={active} onClick={() => toggle(field.key, entityId)}>{active && <Check size={13} />}{label(candidate.entity)}</button>; })}</div> : <small className="muted">Aucune entité correspondante.</small>}</div>; })}</div><div className="actions"><button className="ghost" onClick={() => { setStep(1); setDiagnostic(''); }}><ChevronLeft size={17} /> Retour</button><button className="primary" onClick={finish}>Entrer dans la maison <ArrowRight size={17} /></button></div></>}
  </section></main>;
}
