import { useAppStore } from '../../stores/appStore';
import { useClock } from '../../hooks/useClock';
import { useTemperatureHistory } from '../../hooks/useTemperatureHistory';
import { household, counterDelta, energyKwh, energyCost, houseAlerts, tempoColor } from '../../utils/household';
import { numberState, unavailable } from '../../utils/entities';
import { PowerCard } from '../home/PowerCard';
import { ShoppingList } from './ShoppingList';
import { CoverGroups } from './CoverGroups';
const number = (value?: number, unit = '') => value === undefined ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ''}`;
const date = (value?: string) => { const stamp = Date.parse(value ?? ''); return Number.isFinite(stamp) ? new Date(stamp).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Non renseignée'; };

export function HouseholdPage() {
  const entities = useAppStore(s => s.entities); const demo = useAppStore(s => s.demo); const now = useClock();
  const rates = useAppStore(s => s.mapping.energyRates);
  const ids = [household.energy, ...household.tariffs.map(t => t.id)].filter(id => Boolean(entities[id]));
  const history = useTemperatureHistory(ids, 24);
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const delta = (id: string) => counterDelta(history.data[id] ?? [], midnight.getTime(), numberState(entities[id]));
  const total = energyKwh(entities[household.energy], delta(household.energy));
  const cost = energyCost(household.tariffs.map(t => energyKwh(entities[t.id], delta(t.id))), rates);
  const alerts = houseAlerts(entities);
  const hc = entities['binary_sensor.rte_tempo_heures_creuses'];
  const change = entities['sensor.rte_tempo_heures_creuses_changement'];
  const updates = Object.values(entities).filter(e => e.entity_id.startsWith('update.') && e.state === 'on');
  const costs = household.tariffs.map(t => entities[`${t.id}_cost`]).filter(Boolean);
  return <section className="page household-page"><header className="page-heading"><div><p className="eyebrow">Votre quotidien</p><h1>La maison, <em>à portée de main.</em></h1></div><p className="muted">{now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p></header>
    <div className="house-board"><div className="house-column"><section className="house-panel house-energy"><div className="house-panel-heading"><h2>Électricité · aujourd’hui</h2><button disabled={history.status === 'loading'} onClick={history.reload}>Actualiser</button></div><PowerCard />
      <div className="energy-daily"><strong>{number(total, 'kWh')}</strong><span>consommés depuis minuit</span></div>
      <div className="energy-cost"><b>{number(cost, '€')}</b><span>Coût estimé aujourd’hui, hors abonnement</span></div>
      <p className="history-note">{cost === undefined ? 'Renseignez vos six tarifs et attendez les index de minuit pour calculer le coût.' : 'Calculé avec vos tarifs et les consommations par couleur / période.'}</p>
      <p className="history-note">{history.status === 'loading' ? 'Chargement des index…' : total === undefined ? 'L’index de minuit manque ou le compteur a été interrompu. Aucun total estimé.' : 'Différence entre l’index enregistré à minuit et l’index actuel.'}</p>
      {history.status === 'error' && <p className="house-error" role="status">{history.error}</p>}
      <div className="tariff-strip"><b>{unavailable(hc) ? 'Période tarifaire inconnue' : hc?.state === 'on' ? 'Heures creuses' : 'Heures pleines'}</b>{change && !unavailable(change) && <span>Prochain changement : {date(change.state)}</span>}</div>
      <div className="tempo-colors"><span>Aujourd’hui : <b>{tempoColor(entities['sensor.rte_tempo_couleur_actuelle']?.state)}</b></span><span>Demain : <b>{tempoColor(entities['sensor.rte_tempo_prochaine_couleur']?.state)}</b></span></div>
      <dl className="tariff-breakdown">{household.tariffs.map(t => <div key={t.id}><dt>{t.label}</dt><dd>{number(energyKwh(entities[t.id], delta(t.id)), 'kWh')}</dd></div>)}</dl>
      <details className="house-details"><summary>Mes tarifs Tempo · €/kWh</summary><p className="history-note">Recopiez les prix TTC de votre contrat. Aucun tarif n’est prérempli.</p><div className="energy-rates">{household.tariffs.map((t, i) => <label key={t.id}>{t.label}<input type="number" min="0" step="0.0001" aria-label={`Tarif ${t.label} en euros par kWh`} value={rates?.[i] ?? ''} onChange={e => { const next = Array.from({ length: 6 }, (_, j) => rates?.[j] ?? null); const value = e.target.value === '' ? null : Number(e.target.value); if (value !== null && (!Number.isFinite(value) || value < 0)) return; next[i] = value; useAppStore.setState(s => ({ mapping: { ...s.mapping, energyRates: next } })); }} /></label>)}</div></details>
      {costs.length > 0 && <details className="house-details"><summary>Compteurs de coûts Home Assistant</summary><p className="history-note">Valeurs cumulées fournies par vos capteurs ; elles ne constituent pas le coût de la journée.</p><dl>{costs.map(e => <div key={e.entity_id}><dt>{household.tariffs.find(t => `${t.id}_cost` === e.entity_id)?.label}</dt><dd>{number(numberState(e), String(e.attributes.unit_of_measurement ?? ''))}</dd></div>)}</dl><p>Abonnement : {number(numberState(entities['sensor.cout_fixe_abonnement_eur_19_49eur_mois']), String(entities['sensor.cout_fixe_abonnement_eur_19_49eur_mois']?.attributes.unit_of_measurement ?? ''))}</p></details>}
      {demo && <p className="history-note">Mode démo : les index Linky réels sont absents.</p>}
    </section><ShoppingList /></div><div className="house-column">
    <section className="house-panel"><h2>À surveiller</h2>{alerts.length ? <ul className="house-alerts">{alerts.map(a => <li key={`${a.id}:${a.text}`} className={a.tone}>{a.text}</li>)}</ul> : <p className="muted">Aucune alerte détectée sur les capteurs suivis.</p>}<p className="history-note">Piles à 20 % ou moins · porte du cabanon · réseau Zigbee · capteurs et volets indisponibles</p></section>
    <WeatherOutlook />
    <section className="house-panel"><h2>Volets par étage</h2><CoverGroups /><p className="history-note">Fermeture au coucher du soleil : {entities['automation.fermeture_volets_coucher_soleil']?.state === 'on' ? 'automatisation activée' : 'automatisation inactive ou indisponible'}.</p>{entities['sensor.sun_next_setting'] && <p>Prochain coucher : {date(entities['sensor.sun_next_setting'].state)}</p>}</section>
    <section className="house-panel"><h2>Entretien de la maison</h2><dl className="maintenance-list"><div><dt>Dernière sauvegarde réussie</dt><dd>{date(entities['sensor.backup_derniere_sauvegarde_automatique_reussie']?.state)}</dd></div><div><dt>Prochaine sauvegarde</dt><dd>{date(entities['sensor.backup_prochaine_sauvegarde_automatique_programmee']?.state)}</dd></div><div><dt>Gestionnaire de sauvegardes</dt><dd>{entities['sensor.backup_etat_du_gestionnaire_de_sauvegarde']?.state ?? 'Indisponible'}</dd></div></dl><h3>{updates.length} mise{updates.length > 1 ? 's' : ''} à jour disponible{updates.length > 1 ? 's' : ''}</h3><ul className="maintenance-updates">{updates.map(e => <li key={e.entity_id}><b>{String(e.attributes.friendly_name ?? e.entity_id)}</b><span>{String(e.attributes.installed_version ?? '—')} → {String(e.attributes.latest_version ?? '—')}</span></li>)}</ul><p className="history-note">Les installations et sauvegardes restent pilotées dans Home Assistant.</p></section>
    </div></div></section>;
}
export function WeatherOutlook() {
  const entities = useAppStore(s => s.entities);
  const rain = entities['sensor.marquise_next_rain']; const vigilance = entities['sensor.62_weather_alert'];
  return <section className="house-panel"><h2>La météo à prévoir</h2><dl className="weather-outlook">
    <div><dt>Prochaine pluie</dt><dd>{unavailable(rain) ? 'Non renseignée' : Number.isFinite(Date.parse(rain!.state)) ? date(rain!.state) : rain!.state}</dd></div>
    {[['Pluie', 'rain_chance'], ['Gel', 'freeze_chance'], ['Neige', 'snow_chance']].map(([label, id]) => <div key={id}><dt>Risque de {label.toLowerCase()}</dt><dd>{number(numberState(entities[`sensor.marquise_${id}`]), '%')}</dd></div>)}
    <div><dt>Précipitations du jour</dt><dd>{number(numberState(entities['sensor.marquise_daily_precipitation']), String(entities['sensor.marquise_daily_precipitation']?.attributes.unit_of_measurement ?? ''))}</dd></div>
    <div><dt>Vigilance départementale</dt><dd>{unavailable(vigilance) ? 'Non renseignée' : vigilance?.state}</dd></div>
  </dl></section>;
}
export function HouseholdBrief() {
  const entities = useAppStore(s => s.entities); const setPage = useAppStore(s => s.setPage); const alerts = houseAlerts(entities);
  const shopping = numberState(entities[household.shopping]);
  return <button className="house-brief" onClick={() => setPage('household')}><span><b>Votre maison</b><small>{alerts.length ? `${alerts.length} point${alerts.length > 1 ? 's' : ''} à vérifier` : 'Énergie, météo et entretien'}{shopping !== undefined ? ` · ${shopping} article${shopping > 1 ? 's' : ''} à acheter` : ''}</small></span><span>Voir →</span></button>;
}
