import type { HassEntity } from '../types/homeAssistant';
import type { HistoryPoint } from '../services/home-assistant/history';
import { numberState, unavailable } from './entities';

export const household = {
  power: 'sensor.lixee_sinsts', energy: 'sensor.lixee_east', shopping: 'todo.liste_dachats',
  tariffs: Array.from({ length: 6 }, (_, i) => ({ id: `sensor.lixee_easf0${i + 1}`, label: `${['Bleu', 'Blanc', 'Rouge'][Math.floor(i / 2)]} · ${i % 2 ? 'HP' : 'HC'}` })),
  covers: [{ label: 'Bas', open: 'script.ouvrir_volets_bas', close: 'script.fermeture_de_tout_les_volets_du_bas' }, { label: 'Haut', open: 'script.ouvrir_volets_haut', close: 'script.fermer_volets_haut' }],
};
export function humidityId(temperatureId?: string) { return temperatureId?.endsWith('_temperature') ? temperatureId.replace(/_temperature$/, '_humidity') : undefined; }
export function householdRoomName(id: string, fallback: string) {
  const rooms: Record<string, string> = { sdb: 'Salle de bain', wc: 'Toilettes', bureau: 'Bureau', salon: 'Salon', cuisine: 'Cuisine', chambre_victoire: 'Chambre de Victoire', chambre_parentale: 'Chambre parentale', exterieur: 'Extérieur' };
  const key = id.replace(/^sensor\.therm_/, '').replace(/_temperature$/, '');
  return rooms[key] ?? fallback;
}
export function energyCost(consumption: Array<number | undefined>, rates?: Array<number | null>) {
  if (consumption.length !== 6 || rates?.length !== 6 || consumption.some(n => n === undefined || !Number.isFinite(n) || n < 0) || rates.some(n => n === null || !Number.isFinite(n) || n < 0)) return undefined;
  return consumption.reduce<number>((total, n, i) => total + n! * rates[i]!, 0);
}
export function tempoColor(state?: string) {
  const key = (state ?? '').toLowerCase();
  return /bleu|blue|🔵/.test(key) ? 'Bleu' : /blanc|white|⚪/.test(key) ? 'Blanc' : /rouge|red|🔴/.test(key) ? 'Rouge' : 'Pas encore annoncée';
}
export function counterDelta(points: HistoryPoint[], since: number, current?: number): number | undefined {
  const before = points.filter(p => p.time <= since).at(-1);
  if (!before || current === undefined || before.value === null || current < before.value) return undefined;
  let previous = before.value;
  for (const point of points.filter(p => p.time >= since)) {
    if (point.value === null || point.value < previous) return undefined;
    previous = point.value;
  }
  return current < previous ? undefined : current - before.value;
}
export function energyKwh(entity: HassEntity | undefined, value: number | undefined) {
  const factor = ({ Wh: .001, kWh: 1, MWh: 1000 } as Record<string, number>)[String(entity?.attributes.unit_of_measurement)];
  return value === undefined || factor === undefined ? undefined : value * factor;
}
export function houseAlerts(entities: Record<string, HassEntity>) {
  const alerts: { id: string; text: string; tone: 'warning' | 'info' }[] = [];
  for (const e of Object.values(entities)) {
    const name = String(e.attributes.friendly_name ?? e.entity_id);
    if (e.entity_id === 'binary_sensor.capteur_ouverture_cabanon_contact' && e.state === 'on') alerts.push({ id: e.entity_id, text: 'La porte du cabanon est ouverte', tone: 'warning' });
    if (e.entity_id === 'binary_sensor.zigbee2mqtt_bridge_connection_state' && e.state === 'off') alerts.push({ id: e.entity_id, text: 'Le réseau Zigbee est déconnecté', tone: 'warning' });
    if ((e.attributes.device_class === 'battery' || e.entity_id.endsWith('_battery')) && e.entity_id.startsWith('sensor.') && (e.entity_id.startsWith('sensor.therm_') || e.entity_id.startsWith('sensor.chauffage_') || e.entity_id.includes('cabanon')) && !unavailable(e) && (numberState(e) ?? 100) <= 20) alerts.push({ id: e.entity_id, text: `${name} : ${e.state} % de batterie`, tone: 'warning' });
    if (e.entity_id.endsWith('_battery_low') && e.state === 'on') alerts.push({ id: e.entity_id, text: `${name} : pile faible`, tone: 'warning' });
    if (/^(sensor\.therm_.*_(temperature|humidity)|climate\.|cover\.)/.test(e.entity_id) && unavailable(e)) alerts.push({ id: e.entity_id, text: `${name} : indisponible`, tone: 'info' });
  }
  return alerts;
}
