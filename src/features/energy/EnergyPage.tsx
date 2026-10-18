import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BatteryCharging, CarFront, ChevronRight, Clock3, PlugZap, RefreshCw, Settings2, X, Zap } from 'lucide-react';
import { PowerHistoryModal } from '../home/PowerHistoryModal';
import { useAppStore } from '../../stores/appStore';
import { useEnergyStore } from '../../stores/energyStore';
import { useEnergy } from '../../hooks/useEnergy';
import { useEnergyPrices } from '../../hooks/useEnergyPrices';
import { useVehicle } from '../../hooks/useVehicle';
import { useCharger, chargerLabel, type ChargerStatus } from '../../hooks/useCharger';
import { useClock } from '../../hooks/useClock';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { getHomeAssistantClient } from '../../hooks/useHomeAssistant';
import { activeSlot, euro, n, nextOffPeak, parisParts, parisTime, slots, summarizeStatistics, tempoColor, tempoEntities, type Rates } from '../../services/energy/model';
import { normalizeTariffHistory, sessionCost, type TariffPoint } from '../../services/energy/charging';
import { formatPower, powerWatts } from '../../utils/power';
import { numberState } from '../../utils/entities';
import { reportAge } from '../../services/vehicle/client';

const clock = (time: number) => new Date(time).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
export function EnergyPage() {
  const now = useClock(); const time = now.getTime();
  const entities = useAppStore(s => s.entities); const mapping = useAppStore(s => s.mapping); const demo = useAppStore(s => s.demo); const connection = useAppStore(s => s.connection); const setPage = useAppStore(s => s.setPage);
  const [powerHistory, setPowerHistory] = useState(false);
  const [view, setView] = useState<'energy' | 'charging'>('energy'); const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day'); const [settings, setSettings] = useState(false);
  const history = useEnergy(period); const prices = useEnergyPrices(); const rates = { ...history.rates, ...prices.rates };
  const summary = summarizeStatistics(history.data, rates, history.start, history.end);
  const { session } = useVehicle(!demo); const charger = useCharger(!demo && session.phase === 'connected');
  const data = charger?.online && charger.data && time - charger.data.readAt < 45000 ? charger.data : undefined;
  const powerId = entities[mapping.power ?? ''] ? mapping.power! : 'sensor.lixee_ccasn';
  const watts = powerWatts(entities[mapping.power ?? 'sensor.lixee_ccasn'] ?? entities['sensor.lixee_ccasn']);
  const apparentEntity = entities['sensor.lixee_sinsts'];
  const apparent = apparentEntity?.attributes.unit_of_measurement === 'VA' ? numberState(apparentEntity) : undefined;
  const subscribed = entities['sensor.lixee_pref']; const limit = subscribed?.attributes.unit_of_measurement === 'kVA' ? numberState(subscribed) : undefined;
  const load = apparent != null && limit != null && limit > 0 ? Math.min(100, apparent / (limit * 1000) * 100) : undefined;
  const tempo = tempoEntities(entities, mapping); const current = activeSlot(entities); const next = nextOffPeak(time);
  const fresh = connection === 'connected';
  const grouped = new Map<number, { time: number; value: number; hc: number; hp: number }>();
  for (const bar of summary.bars) {
    const p = parisParts(bar.time);
    const stamp = period === 'day' ? Math.floor(bar.time / 3_600_000) * 3_600_000 : parisTime(+p.year, +p.month, +p.day);
    const bucket = grouped.get(stamp) ?? { time: stamp, value: 0, hc: 0, hp: 0 };
    bucket.value += bar.value; bucket.hc += bar.hc; bucket.hp += bar.hp; grouped.set(stamp, bucket);
  }
  const bars = [...grouped.values()];
  const max = Math.max(.001, ...bars.map(b => b.value));
  const periodLabel = period === 'day' ? 'Aujourd’hui' : period === 'week' ? 'Les 7 derniers jours' : 'Ce mois-ci';
  return <section className="page energy-page">
    <header className="energy-toolbar"><div className="energy-tabs" role="group" aria-label="Vue énergie"><button className={view === 'energy' ? 'selected' : ''} onClick={() => setView('energy')}><Zap size={17} />Énergie</button><button className={view === 'charging' ? 'selected' : ''} onClick={() => setView('charging')}><PlugZap size={17} />Recharges</button></div><div><button onClick={() => setSettings(true)} aria-label="Configurer les tarifs Tempo"><Settings2 size={18} /><span>Tarifs</span></button><button onClick={history.reload} disabled={history.status === 'loading'} aria-label="Actualiser l’énergie"><RefreshCw size={18} className={history.status === 'loading' ? 'spin' : ''} /></button></div></header>
    <div className="energy-layout"><div className="energy-main">
      {view === 'energy' ? <><article className="energy-overview"><div className="energy-overview-top"><span>{periodLabel}</span><div className="energy-period" role="group" aria-label="Période de consommation">{(['day', 'week', 'month'] as const).map(p => <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{({ day: 'Jour', week: '7 jours', month: 'Mois' })[p]}</button>)}</div></div><div className="energy-total"><strong>{n(summary.total, 2)}</strong><span>kWh</span><div><b>{euro(summary.cost)}</b><small>{summary.cost == null ? 'Tarifs à compléter' : 'Estimation · hors abonnement'}</small></div></div><div className="energy-graph" role="img" aria-label={`Consommation ${periodLabel.toLowerCase()}, ${n(summary.total, 2)} kWh. Barres en heures creuses et pleines.`}>{history.status === 'error' ? <p role="status">{history.error}</p> : !summary.bars.length ? <p>{history.status === 'loading' ? 'Chargement des index LiXee…' : 'Aucune statistique enregistrée pour ces index.'}</p> : bars.map(bar => <div className="energy-bar" key={bar.time} title={`${new Date(bar.time).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} · ${n(bar.value, 3)} kWh`} style={{ height: `${Math.max(1, bar.value / max * 100)}%` }}><i style={{ flex: bar.value ? bar.hp / bar.value : 0 }} /><i style={{ flex: bar.value ? bar.hc / bar.value : 0 }} /></div>)}</div><div className="energy-graph-axis"><span>{history.start ? new Date(history.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</span><span><i />HC <i />HP</span><span>{summary.last ? `Relevés jusqu’à ${clock(summary.last)}` : 'Historique HA'}</span></div>{!summary.complete && history.status === 'ready' && <small className="energy-warning">Historique partiel : certains index n’ont pas de statistiques.</small>}</article>
      <article className="energy-breakdown"><div className="energy-table-head"><span>Tempo</span><span>kWh</span><span>Estimation</span></div>{summary.totals.map(slot => <div key={slot.key}><span><i className={`tempo-dot ${slot.color}`} />{slot.label}</span><b>{n(slot.value, 2)}</b><span>{euro(slot.cost)}</span></div>)}</article></> : <><ChargePlan rates={rates} now={time} /><ChargeSessions charger={charger} rates={rates} now={time} connected={fresh} tempoId={tempo.today?.entity_id} /></>}
    </div><aside className="energy-aside"><article className="energy-live"><span><Zap size={17} />Maison <small>{fresh ? 'En direct' : 'Hors connexion'}</small></span><strong>{watts == null ? '—' : formatPower(watts)}</strong>{load != null && <><div className="energy-load" data-high={load >= 85}><i style={{ width: `${load}%` }} /></div><small>{n(apparent == null ? undefined : apparent / 1000, 2)} / {n(limit)} kVA souscrits{load >= 85 && fresh ? ' · charge élevée' : ''}</small></>}{entities[powerId] && <button className="energy-power-history" onClick={() => setPowerHistory(true)}>Courbe de puissance · 24 h →</button>}{data && <div className="energy-wallbox"><PlugZap size={16} /><span>Borne Dé</span><b>{n(data.power, 2)} kW</b></div>}</article>
    <article className="energy-tempo"><div className="energy-tempo-days">{[{ label: 'Aujourd’hui', entity: tempo.today }, { label: 'Demain', entity: tempo.tomorrow }].map(({ label, entity }) => { const color = tempoColor(entity?.state); return <div key={label}><span>{label}</span><b><i className={`tempo-dot ${color ?? ''}`} />{color ? color[0].toUpperCase() + color.slice(1) : 'À confirmer'}</b></div>; })}</div><div className="energy-current-tariff"><span>{current ? current.label : 'Tarif en cours inconnu'}</span><b>{current && rates[current.key] != null ? `${n(rates[current.key], 4)} €/kWh` : 'Tarif à renseigner'}</b></div><div className="energy-offpeak"><Clock3 size={17} /><span><b>{next.active ? 'Heures creuses en cours' : 'Prochaines heures creuses'}</b><small>{next.active ? 'Jusqu’à 6 h' : 'Ce soir · 22 h → 6 h'}</small></span></div>{tempoColor(tempo.tomorrow?.state) === 'rouge' && <p className="energy-warning">Demain rouge : les heures pleines commencent à 6 h.</p>}{!fresh && <small className="energy-warning">Données Tempo conservées · HA déconnecté</small>}</article>
    <button className="energy-vehicle" onClick={() => setPage('vehicle')}><span><CarFront size={17} />ID.4<ChevronRight size={16} /></span><img src="/vehicles/id4-front_right.png" alt="Volkswagen ID.4 grise" /><div><b>{n(session.data?.battery, 0)}<small>%</small></b><span>{n(session.data?.range, 0)} km<small>{session.data && reportAge(session.data.reportedAt, time).stale ? 'Dernier relevé Volkswagen' : 'Autonomie annoncée'}</small></span></div><small><BatteryCharging size={13} />{data ? `${chargerLabel(data.state)} · ${n(data.power, 2)} kW` : charger?.message ?? 'Borne · connexion en attente'}</small></button>
    </aside></div>{powerHistory && createPortal(<PowerHistoryModal entityId={powerId} onClose={() => setPowerHistory(false)} />, document.body)}{settings && <RatesModal rates={rates} onClose={() => setSettings(false)} />}
  </section>;
}

function ChargeSessions({ charger, rates, now, connected, tempoId }: { charger?: ChargerStatus; rates: Rates; now: number; connected: boolean; tempoId?: string }) {
  const history = charger?.history;
  const sessions = [...(history?.active ? [history.active] : []), ...(history?.sessions ?? [])];
  const earliest = sessions.at(-1)?.start;
  const [colors, setColors] = useState<TariffPoint[]>([]);
  const bucket = Math.floor(now / 300000);
  useEffect(() => {
    let stopped = false; setColors([]);
    const client = getHomeAssistantClient();
    if (client && connected && earliest && tempoId) void client.getHistory([tempoId], new Date(earliest - 300000), new Date()).then(payload => { if (!stopped) setColors(normalizeTariffHistory(payload, tempoId)); }).catch(() => {});
    return () => { stopped = true; };
  }, [earliest, connected, tempoId, bucket]);
  const active = history?.active;
  return <article className="energy-sessions"><div className="energy-session-top"><PlugZap size={20} /><span>Borne Dé · historique local</span><small>{charger?.online ? 'Connectée' : 'Hors ligne'}</small></div>{active && <div className="energy-current-session"><span className="vehicle-state-dot" /><span>{charger?.online && charger.data?.state === 'charging' ? 'Recharge en cours' : 'Session ouverte · recharge interrompue'}</span><b>{n(active.energyKwh, 2)} kWh</b></div>}<div className="energy-session-list">{!sessions.length ? <div className="energy-session-empty"><PlugZap size={42} strokeWidth={1} /><p>{charger?.configured === false ? 'Borne non configurée' : 'La prochaine recharge apparaîtra ici.'}</p><small>Le service local enregistre les sessions même si le dashboard est fermé. Les anciennes recharges de l’application Tuya ne sont pas importées.</small></div> : sessions.map(session => { const cost = sessionCost(session, rates, colors); return <div className="energy-session-row" key={session.id}><div><b>{new Date(session.start).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })} · {clock(session.start)}</b><small>{session.end ? `Fin ${clock(session.end)}` : 'En cours'} · pic {n(session.peakKw, 1)} kW{session.partial ? ' · relevé partiel' : ''}</small></div><div><b>≈ {n(session.energyKwh, 2)} kWh</b><small>{cost == null ? 'Coût indisponible' : `≈ ${euro(cost)}`}</small></div></div>; })}</div><footer>Énergie estimée à partir de la puissance mesurée. Les coupures de suivi sont signalées.{history?.startedAt ? ` Suivi depuis le ${new Date(history.startedAt).toLocaleDateString('fr-FR')}.` : ''}<br />Coûts aux tarifs renseignés ; couleur Tempo historique requise.</footer></article>;
}

function RatesModal({ rates, onClose }: { rates: Rates; onClose: () => void }) {
  const dialog = useDialogFocus(); const save = useEnergyStore(s => s.setRates);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(slots.map(slot => [slot.key, rates[slot.key]?.toString() ?? ''])));
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  return createPortal(<div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="energy-rates-modal" ref={dialog} role="dialog" aria-modal="true" aria-label="Tarifs Tempo" tabIndex={-1}><button className="modal-close" onClick={onClose} aria-label="Fermer les tarifs"><X size={20} /></button><h2>Tarifs Tempo</h2><p>Prix TTC en €/kWh de ton contrat. Les prix disponibles dans HA sont repris automatiquement. Les modifications restent dans ce navigateur.</p><form onSubmit={event => { event.preventDefault(); const next: Rates = {}; for (const slot of slots) { const raw = values[slot.key]?.trim(); const value = Number(raw); if (raw && Number.isFinite(value) && value >= 0 && value <= 10) next[slot.key] = value; } save(next); onClose(); }}><div>{slots.map(slot => <label key={slot.key}><span><i className={`tempo-dot ${slot.color}`} />{slot.label}</span><input type="number" inputMode="decimal" min="0" max="10" step="0.0001" placeholder="Non renseigné" value={values[slot.key]} onChange={event => setValues(previous => ({ ...previous, [slot.key]: event.target.value }))} /></label>)}</div><small>Les estimations utilisent ces prix pour toute la période sélectionnée et excluent l’abonnement.</small><button type="submit">Enregistrer</button><button type="button" className="energy-reset-prices" onClick={() => { save({}); onClose(); }}>Reprendre les tarifs de HA</button></form></section></div>, document.body);
}

function ChargePlan({ rates, now }: { rates: Rates; now: number }) {
  const entities = useAppStore(s => s.entities); const mapping = useAppStore(s => s.mapping); const connection = useAppStore(s => s.connection);
  const [energy, setEnergy] = useState('10'); const amount = Number(energy); const valid = energy.trim() && Number.isFinite(amount) && amount > 0 && amount <= 150;
  const current = activeSlot(entities); const color = tempoColor(tempoEntities(entities, mapping).today?.state);
  const night = slots.find(slot => slot.color === color && slot.offPeak); const offPeak = nextOffPeak(now);
  const todayRate = current && rates[current.key]; const nightRate = night && rates[night.key];
  const currentCost = valid && todayRate != null ? amount * todayRate : null;
  const nightCost = valid && nightRate != null ? amount * nightRate : null;
  return <article className="energy-charge-plan"><div><span><Clock3 size={18} />Préparer une recharge</span><label><input aria-label="Énergie à ajouter pour la simulation" type="number" inputMode="decimal" min="0.1" max="150" step="0.5" value={energy} onChange={event => setEnergy(event.target.value)} />kWh</label></div><div className="energy-charge-comparison"><span>Au tarif actuel<b>{euro(currentCost)}</b></span><span>{offPeak.active ? 'En heures creuses' : 'Ce soir · 22 h – 6 h'}<b>{euro(nightCost)}</b></span><span>Écart estimé<b>{currentCost != null && nightCost != null ? euro(Math.max(0, currentCost - nightCost)) : '—'}</b></span></div><small>Simulation hors abonnement, pour une recharge entièrement dans chaque plage. {connection !== 'connected' ? 'Tarif actuel à confirmer : HA déconnecté.' : 'La borne reste en lecture seule.'}</small></article>;
}
