import { describe, expect, it } from 'vitest';
import { formatPower, isPowerSensor, powerWatts } from './power';
import type { HassEntity } from '../types/homeAssistant';
const sensor = (state: string, unit: string): HassEntity => ({ entity_id: 'sensor.power', state, attributes: { unit_of_measurement: unit }, last_changed: '', last_updated: '' });
describe('instantaneous power', () => {
  it('converts kW to watts and formats small and large values', () => {
    expect(powerWatts(sensor('1.24', 'kW'))).toBe(1240);
    expect(formatPower(1240)).toBe('1,24 kW');
    expect(formatPower(0)).toBe('0 W');
    expect(formatPower(520)).toBe('520 W');
  });
  it('keeps signed grid power instead of inventing consumption from export', () => {
    expect(powerWatts(sensor('-2.5', 'kW'))).toBe(-2500);
    expect(formatPower(-2500)).toBe('-2,5 kW');
  });
  it('rejects energy counters, apparent power, unavailable and blank values', () => {
    for (const entity of [sensor('12', 'kWh'), sensor('1200', 'VA'), sensor('unknown', 'W'), sensor('', 'W'), sensor('unavailable', 'W')]) expect(powerWatts(entity)).toBeUndefined();
    expect(isPowerSensor(sensor('10', 'kWh'))).toBe(false);
    expect(isPowerSensor(sensor('10', 'W'))).toBe(true);
  });
});
