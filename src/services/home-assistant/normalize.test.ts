import { describe, expect, it } from 'vitest';
import { discoverCandidates, normalizeEntity } from './normalize';
const entities = [{ entity_id: 'sensor.terrasse_temperature', state: '20', attributes: { friendly_name: 'Température extérieure', device_class: 'temperature' }, last_changed: '', last_updated: '' }, { entity_id: 'climate.salon', state: 'heat', attributes: { friendly_name: 'Salon' }, last_changed: '', last_updated: '' }];
describe('discovery', () => { it('prioritises relevant entity candidates', () => expect(discoverCandidates(entities, 'outdoorTemperature')[0]?.entity.entity_id).toBe('sensor.terrasse_temperature')); it('normalizes a raw state', () => expect(normalizeEntity(entities[1]!).available).toBe(true)); });

it('only suggests temperature sensors when selecting room temperatures', () => {
  const base = { state: '20', last_changed: '', last_updated: '' };
  const candidates = discoverCandidates([
    { ...base, entity_id: 'sensor.salon', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    { ...base, entity_id: 'sensor.temperature_cuisine', attributes: { unit_of_measurement: '°F' } },
    { ...base, entity_id: 'sensor.puissance', attributes: { unit_of_measurement: 'W' } },
    { ...base, entity_id: 'sensor.uv', attributes: {} },
    { ...base, entity_id: 'sensor.humidity', attributes: { unit_of_measurement: '%' } },
    { ...base, entity_id: 'sensor.tempo', attributes: {} }
  ], 'temperatures');
  expect(candidates.map(candidate => candidate.entity.entity_id).sort()).toEqual(['sensor.salon', 'sensor.temperature_cuisine']);
});
