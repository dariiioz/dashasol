// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '../stores/appStore';
import { useTemperatureHistory } from './useTemperatureHistory';
const { getHistory } = vi.hoisted(() => ({ getHistory: vi.fn() }));
vi.mock('./useHomeAssistant', () => ({ getHomeAssistantClient: () => ({ getHistory }) }));
afterEach(() => { cleanup(); getHistory.mockReset(); });
it('does not let an old period response replace the newly selected period', async () => {
  useAppStore.setState({ demo: false, connection: 'connected' });
  let finishOld!: (value: unknown) => void;
  getHistory.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce({ 'sensor.t': [{ s: '22', lu: Date.now() / 1000 - 30 }] });
  const { result, rerender } = renderHook(({ hours }) => useTemperatureHistory(['sensor.t'], hours), { initialProps: { hours: 24 } });
  rerender({ hours: 6 });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => finishOld({ 'sensor.t': [{ s: '10', lu: Date.now() / 1000 - 30 }] }));
  expect(result.current.data['sensor.t'][0].value).toBe(22);
  expect(result.current.end - result.current.start).toBe(6 * 3_600_000);
});
it('reports a recorder failure without inventing historical values', async () => {
  useAppStore.setState({ demo: false, connection: 'connected' });
  getHistory.mockRejectedValue(new Error('Historique non disponible'));
  const { result } = renderHook(() => useTemperatureHistory(['sensor.t'], 24));
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.data).toEqual({});
  expect(result.current.error).toBe('Historique non disponible');
});
