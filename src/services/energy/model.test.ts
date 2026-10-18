import { describe, expect, it } from 'vitest';
import { nextOffPeak, periodStart, ratesFromPreferences, slots, summarizeStatistics, tempoEntities } from './model';
import { normalizeTariffHistory, sessionCost } from './charging';
import type { HassEntity } from '../../types/homeAssistant';

describe('Tempo and energy', () => {
  it('uses real RTE entities when an obsolete onboarding mapping is present', () => {
    const entity = { entity_id: 'sensor.rte_tempo_couleur_actuelle', state: 'Bleu' } as HassEntity;
    expect(tempoEntities({ [entity.entity_id]: entity }, { tempoToday: 'sensor.tempo_aujourdhui' }).today).toBe(entity);
  });
  it('uses Paris calendar boundaries even for a browser in another timezone and DST changes', () => {
    expect(new Date(periodStart(Date.parse('2026-10-25T15:00:00Z'), 'day')).toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(new Date(periodStart(Date.parse('2026-03-29T15:00:00Z'), 'day')).toISOString()).toBe('2026-03-28T23:00:00.000Z');
    const next = nextOffPeak(Date.parse('2026-10-25T01:30:00Z'));
    expect(next.active).toBe(true);
    expect((next.end - next.start) / 3600000).toBe(9);
    expect(new Date(next.end).toISOString()).toBe('2026-10-25T05:00:00.000Z');
  });
  it('does not invent zero readings or cost for missing statistics and ignores negative changes', () => {
    const result = summarizeStatistics({ [slots[0].id]: [{ start: 100, end: 200, change: 2 }, { start: 200, end: 300, change: -1 }] }, {}, 100, 300);
    expect(result.total).toBe(2); expect(result.cost).toBeNull(); expect(result.complete).toBe(false);
    expect(result.totals[1].value).toBeNull();
  });
  it('adds six tariff counters and accepts zero usage without a rate', () => {
    const data = Object.fromEntries(slots.map((slot, index) => [slot.id, [{ start: 100, end: 200, change: index < 2 ? index + 1 : 0 }]]));
    const result = summarizeStatistics(data, { blueHC: .1, blueHP: .2 }, 100, 200);
    expect(result.complete).toBe(true); expect(result.total).toBe(3); expect(result.cost).toBe(.5);
  });
  it('reads both HA grid preference schemas and preserves an explicit zero rate', () => {
    expect(ratesFromPreferences({ energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: slots[0].id, number_energy_price: .1234 }] }, { type: 'grid', stat_energy_from: slots[1].id, number_energy_price: 0 }] })).toEqual({ blueHC: .1234, blueHP: 0 });
  });
  it('prices a recharge across 22h using historical color and refuses absent history', () => {
    const start = Date.parse('2026-10-18T19:55:00Z');
    const session = { id: 'a', start, end: start + 600000, lastSeen: start + 600000, energyKwh: 2, peakKw: 6, partial: false, segments: [{ time: start, kwh: 1 }, { time: start + 300000, kwh: 1 }] };
    const colors = normalizeTariffHistory({ color: [{ lu: (start - 1000) / 1000, s: 'Bleu' }] }, 'color');
    expect(sessionCost(session, { blueHP: .2, blueHC: .1 }, colors)).toBeCloseTo(.3);
    expect(sessionCost(session, { blueHP: .2, blueHC: .1 }, [])).toBeNull();
    expect(sessionCost(session, { blueHP: .2 }, colors)).toBeNull();
  });
});
