// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useAppStore } from '../stores/appStore';
import { useDemoSimulation } from './useDemoSimulation';

afterEach(() => { cleanup(); vi.useRealTimers(); });
it('recreates demo data after reload while keeping the selected equipment', () => {
  vi.useFakeTimers();
  useAppStore.setState({ demo: true, entities: {}, labels: { 'cover.volet_salon': 'Baie' } });
  const selections = useAppStore.getState().dashboard;
  renderHook(useDemoSimulation);
  expect(useAppStore.getState().entities['weather.maison'].state).toBe('partlycloudy');
  expect(useAppStore.getState().entities['sensor.cuisine_temperature'].last_updated).not.toBe('');
  expect(useAppStore.getState().dashboard).toBe(selections);
  expect(useAppStore.getState().labels['cover.volet_salon']).toBe('Baie');
});
it('cancels the simulated reconnection when leaving demo mode', async () => {
  vi.useFakeTimers();
  useAppStore.setState({ demo: true, entities: {} });
  const { unmount } = renderHook(useDemoSimulation);
  await vi.advanceTimersByTimeAsync(45_000);
  unmount();
  useAppStore.setState({ demo: false, connection: 'idle' });
  await vi.advanceTimersByTimeAsync(2_000);
  expect(useAppStore.getState().connection).toBe('idle');
});
