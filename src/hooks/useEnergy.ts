import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { getHomeAssistantClient } from './useHomeAssistant';
import { periodStart, ratesFromPreferences, slots, type Rates, type Statistics } from '../services/energy/model';

export function useEnergy(period: 'day' | 'week' | 'month') {
  const connection = useAppStore(s => s.connection); const demo = useAppStore(s => s.demo);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ period: string; status: 'loading' | 'ready' | 'error'; data: Statistics; rates: Rates; start: number; end: number; error?: string }>({ period, status: 'loading', data: {}, rates: {}, start: 0, end: 0 });
  useEffect(() => {
    let stopped = false; let pending = false;
    const load = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      const end = Date.now(); const start = periodStart(end, period);
      setResult(previous => ({ ...previous, period, status: 'loading', data: previous.period === period ? previous.data : {}, start, end, error: undefined }));
      try {
        const client = getHomeAssistantClient();
        if (demo) throw new Error('Les données énergétiques nécessitent la connexion à ta maison.');
        if (!client || connection !== 'connected') throw new Error('Connexion à Home Assistant nécessaire pour charger la consommation.');
        const [data, prefs] = await Promise.all([
          client.request<Statistics>({ type: 'recorder/statistics_during_period', statistic_ids: slots.map(slot => slot.id), start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(), period: period === 'day' ? '5minute' : period === 'week' ? 'hour' : 'day', types: ['change'], units: { energy: 'kWh' } }),
          client.request<unknown>({ type: 'energy/get_prefs' }).catch(() => undefined),
        ]);
        if (!stopped) setResult({ period, status: 'ready', data, rates: ratesFromPreferences(prefs), start, end });
      } catch (error) {
        if (!stopped) setResult({ period, status: 'error', data: {}, rates: {}, start, end, error: error instanceof Error ? error.message : 'Historique indisponible.' });
      } finally { pending = false; }
    };
    void load(); const timer = window.setInterval(load, 5 * 60_000);
    document.addEventListener('visibilitychange', load);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [period, connection, demo, revision]);
  return { ...result, data: result.period === period ? result.data : {}, status: result.period === period ? result.status : 'loading' as const, reload: () => setRevision(r => r + 1) };
}
