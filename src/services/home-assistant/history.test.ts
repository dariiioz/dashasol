import { describe, expect, it } from 'vitest';
import { chartPoints, demoHistory, normalizeHistory } from './history';
describe('temperature history', () => {
  it('reads compressed WebSocket states, carries the starting value and keeps unavailable gaps', () => {
    const result = normalizeHistory({ 'sensor.t': [{ s: '20', lu: 5 }, { s: '21', lu: 12 }, { s: 'unavailable', lu: 14 }, { s: '19.5', lu: 16 }, { s: '22', lu: 25 }] }, ['sensor.t'], 10_000, 20_000);
    expect(result['sensor.t']).toEqual([{ time: 10_000, value: 20 }, { time: 12_000, value: 21 }, { time: 14_000, value: null }, { time: 16_000, value: 19.5 }]);
  });
  it('supports full timestamp states and ignores malformed entries', () => {
    expect(normalizeHistory({ 'sensor.t': [{ state: '18.2', last_updated: '2026-10-06T10:00:00Z' }, null, { state: '', lu: 1 }, { s: '15', lu: 'invalid' }] }, ['sensor.t', 'sensor.empty'], 0, Date.parse('2026-10-07T00:00:00Z'))['sensor.t']).toEqual([{ time: 1000, value: null }, { time: Date.parse('2026-10-06T10:00:00Z'), value: 18.2 }]);
    expect(normalizeHistory({}, ['sensor.empty'], 0, 10)['sensor.empty']).toEqual([]);
  });
  it('preserves spikes and breaks when reducing a busy sensor', () => {
    const points = Array.from({ length: 3000 }, (_, time) => ({ time, value: time === 200 ? 40 : time === 205 ? null : 20 }));
    const sampled = chartPoints(points);
    expect(sampled.length).toBeLessThanOrEqual(600);
    expect(sampled).toContainEqual({ time: 200, value: 40 });
    expect(sampled).toContainEqual({ time: 205, value: null });
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled.at(-1)).toEqual(points.at(-1));
  });
  it('keeps demo curves within the chosen range and ends with the current value', () => {
    const data = demoHistory(['sensor.t'], 0, 86_400_000, { 'sensor.t': 20 });
    expect(data['sensor.t'].length).toBeGreaterThan(100);
    expect(data['sensor.t'][0].time).toBe(0);
    expect(data['sensor.t'].at(-1)).toEqual({ time: 86_400_000, value: 20 });
  });
});
