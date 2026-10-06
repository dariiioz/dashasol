import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { getHomeAssistantClient } from './useHomeAssistant';
import { demoHistory, normalizeHistory, type TemperatureHistory } from '../services/home-assistant/history';
import { numberState } from '../utils/entities';

export interface HistoryResult { key: string; status: 'loading' | 'ready' | 'error'; data: TemperatureHistory; start: number; end: number; error?: string }
export function useTemperatureHistory(ids: string[], hours: number, kind: 'temperature' | 'power' = 'temperature') {
  const demo = useAppStore(s => s.demo);
  const connection = useAppStore(s => s.connection);
  const key = JSON.stringify([...new Set(ids)].sort());
  const resultKey = `${key}:${hours}:${demo}:${kind}`;
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<HistoryResult>({ key: '', status: 'loading', data: {}, start: 0, end: 0 });
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    const entityIds = JSON.parse(key) as string[];
    const load = async () => {
      if (pending) return;
      pending = true;
      const end = Date.now(); const start = end - hours * 3_600_000;
      setResult(previous => ({ key: resultKey, status: 'loading', data: previous.key === resultKey ? previous.data : {}, start, end }));
      try {
        let data: TemperatureHistory;
        if (!entityIds.length) data = {};
        else if (demo) {
          const entities = useAppStore.getState().entities;
          data = demoHistory(entityIds, start, end, Object.fromEntries(entityIds.map(id => [id, numberState(entities[id]) ?? NaN])), kind);
        } else {
          const client = getHomeAssistantClient();
          if (!client || connection !== 'connected') throw new Error('Connectez Home Assistant pour charger les historiques.');
          data = normalizeHistory(await client.getHistory(entityIds, new Date(start), new Date(end)), entityIds, start, end);
        }
        if (!cancelled) setResult({ key: resultKey, status: 'ready', data, start, end });
      } catch (error) {
        if (!cancelled) setResult({ key: resultKey, status: 'error', data: {}, start, end, error: error instanceof Error ? error.message : 'Impossible de charger les historiques.' });
      } finally { pending = false; }
    };
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 5 * 60_000);
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [key, hours, demo, connection, refresh, resultKey, kind]);
  const active = result.key === resultKey ? result : { ...result, status: 'loading' as const, data: {}, error: undefined };
  return { ...active, reload: () => setRefresh(value => value + 1) };
}
