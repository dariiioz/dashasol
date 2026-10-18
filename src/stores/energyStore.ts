import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Rates } from '../services/energy/model';

export const useEnergyStore = create<{ rates: Rates; setRates: (rates: Rates) => void }>()(persist(set => ({ rates: {}, setRates: rates => set({ rates }) }), { name: 'domoryx-energy-v1' }));
