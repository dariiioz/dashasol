import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { demoEntities } from '../services/home-assistant/demo';
/** Keeps the demo alive without affecting real Home Assistant data. Reading the store lazily avoids rebuilding the interval on every simulated tick. */
export function useDemoSimulation() {
  const demo = useAppStore(s => s.demo);
  const empty = useAppStore(s => Object.keys(s.entities).length === 0);
  useEffect(() => {
    if (!demo) return;
    const store = useAppStore.getState();
    if (!Object.keys(store.entities).length) {
      const now = new Date().toISOString();
      store.setEntities(demoEntities.map(entity => ({ ...entity, last_changed: now, last_updated: now })));
    }
    store.setConnection('connected');
    let step = 0;
    let reconnect: number | undefined;
    const id = window.setInterval(() => {
      step += 1;
      const store = useAppStore.getState();
      const power = store.entities['sensor.maison_puissance'];
      if (power) store.updateEntity({ ...power, state: String(Math.round(1240 + 280 * Math.sin(step / 3) + 120 * Math.sin(step))), last_updated: new Date().toISOString() });
      const sensor = store.entities['sensor.salon_temperature'];
      if (sensor) {
        const next = 20.4 + Math.sin(step / 2) * .8;
        store.updateEntity({ ...sensor, state: next.toFixed(1), last_updated: new Date().toISOString() });
      }
      if (step % 9 === 0) {
        store.setConnection('offline', 'Simulation d’une perte réseau.');
        reconnect = window.setTimeout(() => useAppStore.getState().setConnection('connected'), 1300);
      }
    }, 5000);
    return () => { window.clearInterval(id); window.clearTimeout(reconnect); };
  }, [demo, empty]);
}
