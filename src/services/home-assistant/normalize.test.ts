import { describe, expect, it } from 'vitest';
import { discoverCandidates, normalizeEntity } from './normalize';
const entities = [{ entity_id: 'sensor.terrasse_temperature', state: '20', attributes: { friendly_name: 'Température extérieure', device_class: 'temperature' }, last_changed: '', last_updated: '' }, { entity_id: 'climate.salon', state: 'heat', attributes: { friendly_name: 'Salon' }, last_changed: '', last_updated: '' }];
describe('discovery', () => { it('prioritises relevant entity candidates', () => expect(discoverCandidates(entities, 'outdoorTemperature')[0]?.entity.entity_id).toBe('sensor.terrasse_temperature')); it('normalizes a raw state', () => expect(normalizeEntity(entities[1]!).available).toBe(true)); });
