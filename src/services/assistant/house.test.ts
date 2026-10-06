import { describe, expect, it } from 'vitest';
import { controllableIds, houseDigest, type HouseContext } from './house';
import { dashboardFromMapping } from '../../utils/dashboard';
import type { HassEntity } from '../../types/homeAssistant';
const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes, last_changed: '', last_updated: '' });
const context = (): HouseContext => ({
  homeName: 'Le Domoryx',
  entities: Object.fromEntries([entity('weather.home', 'sunny', { temperature: 24, humidity: 40 }), entity('sensor.salon_temperature', '21.4', { unit_of_measurement: '°C' }), entity('climate.salon', 'heat', { current_temperature: 20.1, temperature: 21, hvac_action: 'heating' }), entity('cover.volet_salon', 'open', { current_position: 60 }), entity('media_player.salon', 'playing', { media_artist: 'Nina Simone', media_title: 'Feeling Good' }), entity('automation.volets_bas', 'on')].map(item => [item.entity_id, item])),
  dashboard: { ...dashboardFromMapping({ temperatures: ['sensor.salon_temperature'], climates: ['climate.salon'], covers: ['cover.volet_salon'], mediaPlayers: ['media_player.salon'] }), automationLower: { entityId: 'automation.volets_bas', enabled: true, order: 0 } },
  mapping: { weather: 'weather.home' }, labels: { 'cover.volet_salon': 'Baie vitrée' }
});
describe('house digest', () => {
  it('names only the entities the household selected, with their personal labels', () => { const digest = houseDigest(context(), new Date('2026-08-09T16:20:00')); expect(digest).toContain('Le Domoryx'); expect(digest).toContain('Ensoleillé, 24 °C, humidité 40 %'); expect(digest).toContain('- cover.volet_salon « Baie vitrée » : ouvert à 60 %'); expect(digest).toContain('20.1 °C mesurés, consigne 21 °C, mode chauffage, chauffe en ce moment'); expect(digest).toContain('Nina Simone – Feeling Good'); expect(digest).toContain('automation.volets_bas'); });
  it('drops the sections the house has nothing to say about', () => { const bare = houseDigest({ entities: {}, dashboard: dashboardFromMapping(), mapping: {}, labels: {} }); expect(bare).toContain('aucune donnée météo'); expect(bare).not.toContain('Volets'); });
  it('exposes as controllable only the selected equipment that really exists', () => { const withGhost = context(); withGhost.dashboard.coverEntities = [{ entityId: 'cover.volet_salon', enabled: true, order: 0 }, { entityId: 'cover.disparu', enabled: true, order: 1 }]; expect(controllableIds(withGhost)).toEqual(['climate.salon', 'cover.volet_salon', 'media_player.salon', 'automation.volets_bas']); });
});
