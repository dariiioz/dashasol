// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { timerTime, useTimerStore } from './timerStore';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); useTimerStore.setState({ duration: 300, remaining: 300, deadline: null, finished: false, open: false }); });
afterEach(() => vi.useRealTimers());
it('uses the deadline even when ticks are suspended and restores it from storage', async () => {
  useTimerStore.getState().start(60);
  const saved = localStorage.getItem('domoryx-timer')!;
  useTimerStore.setState({ deadline: null });
  localStorage.setItem('domoryx-timer', saved);
  await useTimerStore.persist.rehydrate();
  vi.setSystemTime(161000); useTimerStore.getState().tick();
  expect(useTimerStore.getState()).toMatchObject({ remaining: 0, deadline: null, finished: true });
});
it('pauses, resumes and resets without counting paused time', () => {
  useTimerStore.getState().start(60); vi.setSystemTime(110000); useTimerStore.getState().pause();
  expect(useTimerStore.getState().remaining).toBe(50);
  vi.setSystemTime(200000); useTimerStore.getState().resume();
  expect(useTimerStore.getState().deadline).toBe(250000);
  useTimerStore.getState().reset();
  expect(useTimerStore.getState()).toMatchObject({ remaining: 60, deadline: null, finished: false });
});
it('rejects invalid durations and formats hours', () => {
  for (const value of [0, -1, NaN, Infinity, 86400]) useTimerStore.getState().start(value);
  expect(useTimerStore.getState().deadline).toBeNull();
  expect(timerTime(3661)).toBe('1:01:01');
});
