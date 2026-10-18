import { create } from 'zustand';

/** One live player for the whole dashboard, independent of the active page. */
export const useDoorbellStore = create<{ open: boolean; ringing: boolean; openLive: (ringing?: boolean) => void; closeLive: () => void }>(set => ({
  open: false, ringing: false,
  openLive: (ringing = false) => set(state => state.open ? ringing && !state.ringing ? { ringing: true } : state : { open: true, ringing }),
  closeLive: () => set({ open: false, ringing: false }),
}));
