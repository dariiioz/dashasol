import { describe, expect, it } from 'vitest';
import { horizonEvent, skyPhase } from './sky';
import type { HassEntity } from '../../types/homeAssistant';
const sun = (attributes: Record<string, unknown>, state = 'above_horizon'): HassEntity => ({ entity_id: 'sun.sun', state, attributes, last_changed: '', last_updated: '' });
const noon = new Date('2026-07-28T12:00:00');
describe('sky', () => {
  it('follows the real elevation of the sun', () => {
    expect(skyPhase(sun({ elevation: 34 }), noon)).toBe('day');
    expect(skyPhase(sun({ elevation: -2, rising: true }), noon)).toBe('dawn');
    expect(skyPhase(sun({ elevation: -2, rising: false }), noon)).toBe('dusk');
    expect(skyPhase(sun({ elevation: -21 }, 'below_horizon'), noon)).toBe('night');
  });
  it('falls back to the clock when Home Assistant exposes no sun', () => {
    expect(skyPhase(undefined, new Date('2026-07-28T03:00:00'))).toBe('night');
    expect(skyPhase(undefined, new Date('2026-07-28T07:00:00'))).toBe('dawn');
    expect(skyPhase(undefined, new Date('2026-07-28T14:00:00'))).toBe('day');
    expect(skyPhase(undefined, new Date('2026-07-28T20:30:00'))).toBe('dusk');
  });
  it('announces the next horizon crossing that will actually happen', () => {
    expect(horizonEvent(sun({ next_setting: '2026-07-28T21:44:00' }), 'day')).toMatchObject({ label: 'Coucher' });
    expect(horizonEvent(sun({ next_rising: '2026-07-29T06:32:00' }), 'night')).toMatchObject({ label: 'Lever' });
    expect(horizonEvent(sun({}), 'day')).toBeUndefined();
  });
});
