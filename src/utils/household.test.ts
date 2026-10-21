import { expect, it } from 'vitest';
import { counterDelta, energyCost, energyKwh, houseAlerts, humidityId, tempoColor } from './household';
import { formatReading, powerReading } from './power';
import type { HassEntity } from '../types/homeAssistant';
const entity = (id: string, state: string, unit?: string): HassEntity => ({ entity_id: id, state, attributes: { unit_of_measurement: unit }, last_changed: '', last_updated: '' });
it('keeps VA distinct from W and converts kVA for display', () => {
  expect(powerReading(entity('sensor.lixee_sinsts', '1.25', 'kVA'))).toEqual({ value: 1250, apparent: true });
  expect(formatReading(1250, true)).toBe('1,25 kVA');
  expect(powerReading(entity('sensor.energy', '500', 'kWh'))).toBeUndefined();
  expect(powerReading(entity('sensor.p', 'unavailable', 'VA'))).toBeUndefined();
});
it('uses the last recorded midnight index and refuses absent or interrupted baselines', () => {
  expect(counterDelta([{ time: 1, value: 100 }, { time: 3, value: 104 }], 2, 106)).toBe(6);
  expect(counterDelta([{ time: 3, value: 104 }], 2, 106)).toBeUndefined();
  expect(counterDelta([{ time: 1, value: 100 }, { time: 2, value: null }], 2, 106)).toBeUndefined();
  expect(counterDelta([{ time: 1, value: 100 }, { time: 3, value: 105 }, { time: 4, value: 102 }], 2, 106)).toBeUndefined();
  expect(counterDelta([{ time: 1, value: 100 }], 2, 90)).toBeUndefined();
});
it('requires complete consumption and user supplied tariffs before estimating cost', () => {
  expect(energyCost([1, 2, 0, 0, 0, 0], [.1, .2, .3, .4, .5, .6])).toBe(.5);
  expect(energyCost([1, 2, 0, 0, 0, undefined], [.1, .2, .3, .4, .5, .6])).toBeUndefined();
  expect(energyCost([1, 2, 0, 0, 0, 0])).toBeUndefined();
  expect(energyKwh(entity('sensor.e', '2000', 'Wh'), 2000)).toBe(2);
  expect(energyKwh(entity('sensor.e', '2000', 'Wh'), undefined)).toBeUndefined();
});
it('finds humidity pairs and recognizes Tempo visual states', () => {
  expect(humidityId('sensor.therm_salon_temperature')).toBe('sensor.therm_salon_humidity');
  expect(humidityId('sensor.chauffage_local_temp')).toBeUndefined();
  expect(tempoColor('🔵')).toBe('Bleu'); expect(tempoColor('White')).toBe('Blanc');
});
it('alerts on the cabanon, low device batteries and Zigbee without treating unknown as zero', () => {
  const entities = [entity('sensor.therm_salon_battery', '15', '%'), entity('sensor.therm_wc_battery', 'unknown', '%'), entity('binary_sensor.capteur_ouverture_cabanon_contact', 'on'), entity('binary_sensor.zigbee2mqtt_bridge_connection_state', 'off')];
  expect(houseAlerts(Object.fromEntries(entities.map(e => [e.entity_id, e])))).toHaveLength(3);
});
