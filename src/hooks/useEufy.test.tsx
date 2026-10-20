// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEufy } from './useEufy';
import { eufyRequest, initialEufy } from '../services/eufy/client';
import { useEufySession } from '../services/eufy/session';
vi.mock('../services/eufy/client', async importOriginal => ({ ...await importOriginal<typeof import('../services/eufy/client')>(), eufyRequest: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.mocked(eufyRequest).mockReset().mockResolvedValue(initialEufy); useEufySession.setState({ status: initialEufy, error: undefined, busy: false }); });
afterEach(async () => { cleanup(); await act(async () => {}); vi.useRealTimers(); });
it('shares one status request between views and slows down while unconfigured', async () => {
  renderHook(() => useEufy(true, 3000)); renderHook(() => useEufy(true, 5000));
  await act(async () => {}); expect(eufyRequest).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(29999)); expect(eufyRequest).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(eufyRequest).toHaveBeenCalledTimes(2);
});
it('polls a connected doorbell at most once every three seconds across consumers', async () => {
  vi.mocked(eufyRequest).mockResolvedValue({ ...initialEufy, phase: 'connected' });
  renderHook(() => useEufy(true, 1500)); renderHook(() => useEufy(true, 5000));
  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(2999)); expect(eufyRequest).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(eufyRequest).toHaveBeenCalledTimes(2);
});
it('keeps previous device data on errors and stops polling after the last view leaves', async () => {
  const hook = renderHook(() => useEufy(true)); await act(async () => {});
  vi.mocked(eufyRequest).mockRejectedValue(new Error('Service unavailable'));
  await act(async () => { await hook.result.current.run('status'); });
  expect(hook.result.current.serviceAvailable).toBe(false); expect(hook.result.current.status).toEqual(initialEufy);
  hook.unmount(); const count = vi.mocked(eufyRequest).mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(120000)); expect(eufyRequest).toHaveBeenCalledTimes(count);
});
