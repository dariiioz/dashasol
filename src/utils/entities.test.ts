import { describe, expect, it } from 'vitest'; import { degreeUnit, feature, freshness, nameOf, unavailable, weatherLabel } from './entities';
const entity = { entity_id: 'media_player.test', state: 'unavailable', attributes: { supported_features: 5 }, last_changed: '', last_updated: '' };
const sensor = { entity_id: 'sensor.therm_sdb', state: '21.4', attributes: { friendly_name: 'therm_sdb Température', unit_of_measurement: '°C' }, last_changed: '', last_updated: '2026-07-28T16:00:00.000Z' };
describe('entity utilities', () => {
  it('marks unavailable values', () => expect(unavailable(entity)).toBe(true));
  it('reads supported feature flags', () => expect(feature(entity, 4)).toBe(true));
  it('prefers the personal label over the Home Assistant name', () => expect(nameOf({ 'sensor.therm_sdb': 'Salle de bain' }, sensor)).toBe('Salle de bain'));
  it('falls back to the Home Assistant name, then to a readable entity id', () => { expect(nameOf({}, sensor)).toBe('therm_sdb Température'); expect(nameOf({}, undefined, 'cover.volet_baie')).toBe('Volet Baie'); });
  it('keeps the degree sign for Celsius and the real unit otherwise', () => { expect(degreeUnit(sensor)).toBe('°'); expect(degreeUnit({ ...sensor, attributes: { unit_of_measurement: '°F' } })).toBe('°F'); });
  it('translates Home Assistant weather conditions', () => { expect(weatherLabel('partlycloudy')).toBe('Partiellement nuageux'); expect(weatherLabel(undefined)).toBe('Données météo en attente'); });
  it('tells how old a measurement really is', () => { expect(freshness(sensor, new Date('2026-07-28T16:00:30.000Z'))).toBe('Actualisé à l’instant'); expect(freshness(sensor, new Date('2026-07-28T16:25:00.000Z'))).toBe('Actualisé il y a 25 min'); expect(freshness(sensor, new Date('2026-07-28T19:00:00.000Z'))).toBe('Actualisé il y a 3 h'); });
});
