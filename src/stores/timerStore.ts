import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  duration: number;
  remaining: number;
  deadline: number | null;
  finished: boolean;
  paused: boolean;
  open: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: () => void;
}
export const useTimerStore = create<TimerState>()(persist((set, get) => ({
  duration: 300, remaining: 300, deadline: null, finished: false, paused: false, open: false,
  start: seconds => {
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86399) return;
    const duration = Math.floor(seconds);
    set({ duration, remaining: duration, deadline: Date.now() + duration * 1000, finished: false, paused: false });
  },
  pause: () => {
    get().tick();
    if (!get().finished) set({ deadline: null, paused: true });
  },
  resume: () => { const { remaining, finished } = get(); if (remaining > 0 && !finished) set({ deadline: Date.now() + remaining * 1000, paused: false }); },
  reset: () => set({ deadline: null, remaining: get().duration, finished: false, paused: false }),
  tick: () => {
    const { deadline } = get();
    if (deadline === null) return;
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) set({ remaining: 0, deadline: null, finished: true, paused: false });
    else if (remaining !== get().remaining) set({ remaining });
  },
}), { name: 'domoryx-timer', partialize: ({ duration, remaining, deadline, finished, paused }) => ({ duration, remaining, deadline, finished, paused }) }));

export function timerTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
