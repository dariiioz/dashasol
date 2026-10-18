// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dateKey, eventTime, getEvents, getShopping, overlaps, plannerService, validateEvent } from './client';
import { useAppStore } from '../../stores/appStore';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../hooks/useHomeAssistant', () => ({ getHomeAssistantClient: () => ({ request }) }));
beforeEach(() => { request.mockReset(); useAppStore.setState({ connection: 'connected' }); });
describe('Home Assistant agenda', () => {
  it('requests todo response and retains unique IDs for duplicate names', async () => {
    request.mockResolvedValue({ response: { 'todo.shopping_list': { items: [{ uid: '1', summary: 'Lait', status: 'needs_action' }, { uid: '2', summary: 'Lait', status: 'completed' }] } } });
    expect((await getShopping('todo.shopping_list')).map(i => i.uid)).toEqual(['1', '2']);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ type: 'call_service', domain: 'todo', service: 'get_items', return_response: true }));
  });
  it('does not pretend an unavailable list is empty', async () => {
    request.mockResolvedValue({ response: {} });
    await expect(getShopping('todo.shopping_list')).rejects.toThrow('invalide');
  });
  it('preserves all-day end exclusivity across local dates', () => {
    const event = { uid: '1', summary: 'Vacances', start: '2026-10-24', end: '2026-10-27', allDay: true };
    expect(overlaps(event, new Date('2026-10-26T00:00:00'), new Date('2026-10-27T00:00:00'))).toBe(true);
    expect(overlaps(event, new Date('2026-10-27T00:00:00'), new Date('2026-10-28T00:00:00'))).toBe(false);
    expect(dateKey(new Date(eventTime(event.start)))).toBe('2026-10-24');
  });
  it('gets all events in a range, including all-day entries', async () => {
    request.mockResolvedValue({ response: { 'calendar.personnel': { events: [{ summary: 'Anniversaire', start: '2026-10-20', end: '2026-10-21' }, { summary: 'RDV', start: '2026-10-20T10:00:00+02:00', end: '2026-10-20T11:00:00+02:00' }] } } });
    const events = await getEvents('calendar.personnel', new Date('2026-10-01'), new Date('2026-11-01'));
    expect(events.map(e => e.allDay)).toEqual([true, false]);
    expect(new Set(events.map(e => e.uid)).size).toBe(2);
  });
  it('rejects invalid intervals and offline writes', async () => {
    expect(() => validateEvent('RDV', '2026-10-20T11:00', '2026-10-20T10:00')).toThrow();
    expect(() => validateEvent(' ', '2026-10-20', '2026-10-21')).toThrow();
    useAppStore.setState({ connection: 'offline' });
    await expect(plannerService('todo', 'add_item', 'todo.shopping_list', { item: 'Lait' })).rejects.toThrow('déconnecté');
    expect(request).not.toHaveBeenCalled();
  });
});
