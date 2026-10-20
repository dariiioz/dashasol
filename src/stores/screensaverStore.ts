import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useScreensaverStore = create<{ active: boolean; activate: () => void; dismiss: () => void }>()(persist(set => ({
  active: false,
  activate: () => set({ active: true }),
  dismiss: () => set({ active: false }),
}), { name: 'domoryx-screensaver' }));
