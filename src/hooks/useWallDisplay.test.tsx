// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { isNightTime, useWallDisplay } from './useWallDisplay';
import { useAppStore } from '../stores/appStore';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('handles night ranges across midnight and rejects invalid or empty intervals', () => {
  expect(isNightTime(new Date(2026, 9, 20, 23), '22:00', '07:00')).toBe(true);
  expect(isNightTime(new Date(2026, 9, 20, 6), '22:00', '07:00')).toBe(true);
  expect(isNightTime(new Date(2026, 9, 20, 12), '22:00', '07:00')).toBe(false);
  expect(isNightTime(new Date(), 'bad', '07:00')).toBe(false);
  expect(isNightTime(new Date(), '07:00', '07:00')).toBe(false);
});
it('releases the screen lock on unmount and requests it again after a release', async () => {
  vi.stubGlobal('isSecureContext', true);
  const lock = Object.assign(new EventTarget(), { released: false, release: vi.fn().mockResolvedValue(undefined) });
  const request = vi.fn().mockResolvedValue(lock); vi.stubGlobal('navigator', { wakeLock: { request } });
  useAppStore.getState().setPreferences({ wall: { keepAwake: true, nightMode: false, nightStart: '22:00', nightEnd: '07:00' } });
  const hook = renderHook(() => useWallDisplay());
  await waitFor(() => expect(hook.result.current.wakeStatus).toBe('active'));
  act(() => { lock.released = true; lock.dispatchEvent(new Event('release')); });
  act(() => window.dispatchEvent(new Event('domoryx-wake-retry')));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  hook.unmount(); expect(lock.release).toHaveBeenCalled();
});
it('reports unavailable screen lock instead of failing the application', async () => {
  vi.stubGlobal('isSecureContext', false);
  useAppStore.getState().setPreferences({ wall: { keepAwake: true, nightMode: false, nightStart: '22:00', nightEnd: '07:00' } });
  const hook = renderHook(() => useWallDisplay());
  await waitFor(() => expect(hook.result.current.wakeStatus).toBe('unavailable'));
});
