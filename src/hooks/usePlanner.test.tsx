// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePlanner } from './usePlanner';
import { usePlannerStore, type ShoppingItem } from '../stores/plannerStore';
import { useAppStore } from '../stores/appStore';
const mock = vi.hoisted(() => ({ getShopping: vi.fn(), getEvents: vi.fn(), plannerService: vi.fn() }));
vi.mock('../services/planner/client', async importOriginal => ({ ...await importOriginal<typeof import('../services/planner/client')>(), ...mock }));
beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ demo: false, connection: 'connected', entities: { 'todo.courses': { entity_id: 'todo.courses', state: '2', attributes: { supported_features: 7 }, last_changed: '', last_updated: '' } } });
  usePlannerStore.setState({ todoSource: 'todo.courses', calendarSource: 'local', items: [], events: [] });
  mock.getEvents.mockResolvedValue([]);
});
afterEach(cleanup);
it('refreshes remaining remote items after a partial clear and stops at the failed UID', async () => {
  let remaining: ShoppingItem[] = ['a', 'b', 'c'].map(uid => ({ uid, summary: 'Même nom', status: 'needs_action' }));
  mock.getShopping.mockImplementation(async () => [...remaining]);
  mock.plannerService.mockImplementation(async (_domain, _service, _source, { item }) => {
    if (item === 'b') throw new Error('Home Assistant a refusé la suppression.');
    remaining = remaining.filter(entry => entry.uid !== item);
  });
  const { result } = renderHook(() => usePlanner(new Date('2026-10-01'), new Date('2026-11-01')));
  await waitFor(() => expect(result.current.items).toHaveLength(3));
  let cleared: boolean | undefined;
  await act(async () => { cleared = await result.current.clearItems(['a', 'b', 'c']); });
  expect(cleared).toBe(false);
  expect(result.current.items.map(item => item.uid)).toEqual(['b', 'c']);
  expect(mock.plannerService.mock.calls.map(call => call[3].item)).toEqual(['a', 'b']);
  expect(result.current.todoError).toContain('refusé'); expect(result.current.busy).toBe(false);
});
it('preserves local drafts and items when an add fails, and blocks offline clears', async () => {
  mock.getShopping.mockResolvedValue([{ uid: 'a', summary: 'Pain', status: 'needs_action' }]);
  mock.plannerService.mockRejectedValue(new Error('Ajout refusé.'));
  const { result } = renderHook(() => usePlanner(new Date('2026-10-01'), new Date('2026-11-01')));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  await act(async () => { expect(await result.current.addItem('Lait')).toBe(false); });
  expect(result.current.items).toHaveLength(1); expect(result.current.todoError).toContain('Ajout refusé');
  act(() => useAppStore.setState({ connection: 'offline' }));
  mock.plannerService.mockClear();
  await act(async () => { expect(await result.current.clearItems(['a'])).toBe(false); });
  expect(mock.plannerService).not.toHaveBeenCalled();
});
