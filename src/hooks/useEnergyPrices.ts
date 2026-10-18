import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useEnergyStore } from '../stores/energyStore';
import { getHomeAssistantClient } from './useHomeAssistant';
import { ratesFromPreferences, type Rates } from '../services/energy/model';

export function useEnergyPrices() {
  const overrides = useEnergyStore(s => s.rates);
  const connection = useAppStore(s => s.connection);
  const [imported, setImported] = useState<Rates>({});
  useEffect(() => {
    let stopped = false;
    const client = getHomeAssistantClient();
    if (client && connection === 'connected') void client.request({ type: 'energy/get_prefs' }).then(prefs => { if (!stopped) setImported(ratesFromPreferences(prefs)); }).catch(() => {});
    return () => { stopped = true; };
  }, [connection]);
  return { rates: { ...imported, ...overrides }, imported };
}
