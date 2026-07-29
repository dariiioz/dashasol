import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
/** Keeps the demo alive without affecting real Home Assistant data. Reading the store lazily avoids rebuilding the interval on every simulated tick. */
export function useDemoSimulation() {
  const demo = useAppStore(s => s.demo);
  useEffect(() => { if (!demo) return; useAppStore.getState().setConnection('connected'); let step = 0; const id = window.setInterval(() => { step += 1; const store = useAppStore.getState(); const sensor = store.entities['sensor.salon_temperature']; if (sensor) { const next = 20.4 + Math.sin(step / 2) * .8; store.updateEntity({ ...sensor, state: next.toFixed(1), last_updated: new Date().toISOString() }); } if (step % 9 === 0) { store.setConnection('offline', 'Simulation d’une perte réseau.'); window.setTimeout(() => useAppStore.getState().setConnection('connected'), 1300); } }, 5000); return () => window.clearInterval(id); }, [demo]);
}
