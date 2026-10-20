import type { HassEntity, HassRegistries } from '../../types/homeAssistant';
import { unavailable } from '../../utils/entities';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const percentage = (value: unknown) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : undefined;
};
export function personDetails(name: string, entities: Record<string, HassEntity>, registries?: HassRegistries, selectedId?: string) {
  const key = normalize(name);
  const matches = Object.values(entities).filter(entity => entity.entity_id.startsWith('person.') && normalize(String(entity.attributes.friendly_name ?? '')).split(/[\s,]+/).includes(key));
  const selected = selectedId?.startsWith('person.') ? entities[selectedId] : undefined;
  const person = selectedId ? selected : entities[`person.${key}`] ?? (matches.length === 1 ? matches[0] : undefined);
  const source = typeof person?.attributes.source === 'string' ? person.attributes.source : undefined;
  const tracker = source?.startsWith('device_tracker.') ? entities[source] : undefined;
  const deviceId = registries?.entities.find(entry => entry.entity_id === tracker?.entity_id)?.device_id;
  // Only use sensors explicitly linked to this tracker’s device, never a similar phone name.
  const sensorIds = deviceId ? registries?.entities.filter(entry => entry.device_id === deviceId).map(entry => entry.entity_id) ?? [] : [];
  const batterySensor = sensorIds.map(id => entities[String(id)]).find(entity => entity?.entity_id.startsWith('sensor.') && entity.attributes.device_class === 'battery' && entity.attributes.unit_of_measurement === '%' && !unavailable(entity));
  const battery = !unavailable(batterySensor) ? percentage(batterySensor?.state) : !unavailable(tracker) ? percentage(tracker?.attributes.battery_level ?? tracker?.attributes.battery) : undefined;
  const chargingSensor = sensorIds.map(id => entities[String(id)]).find(entity => entity?.entity_id.startsWith('binary_sensor.') && entity.attributes.device_class === 'battery_charging' && !unavailable(entity));
  const charging = chargingSensor && ['on', 'off'].includes(chargingSensor.state) ? chargingSensor.state === 'on' : undefined;
  const state = person?.state;
  const status = unavailable(person) ? 'Indisponible' : state === 'home' ? 'À la maison' : state === 'not_home' ? 'À l’extérieur' : state!;
  const accuracyValue = person?.attributes.gps_accuracy ?? tracker?.attributes.gps_accuracy;
  const accuracy = typeof accuracyValue === 'number' && Number.isFinite(accuracyValue) && accuracyValue >= 0 ? accuracyValue : undefined;
  return { name, person, tracker, status, battery, charging, accuracy, home: state === 'home', available: !unavailable(person) };
}
