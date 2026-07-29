import { useEffect, useRef } from 'react';
import { HomeAssistantClient } from '../services/home-assistant/client';
import { useAppStore } from '../stores/appStore';
import type { ConnectionStatus } from '../types/homeAssistant';

let activeClient: HomeAssistantClient | undefined;
export const getHomeAssistantClient = () => activeClient;
export function useHomeAssistant() {
  const client = useRef<HomeAssistantClient | undefined>(undefined);
  const config = useAppStore(s => s.config); const configured = useAppStore(s => s.configured); const demo = useAppStore(s => s.demo);
  const setEntities = useAppStore(s => s.setEntities); const updateEntity = useAppStore(s => s.updateEntity); const setConnection = useAppStore(s => s.setConnection); const setRegistries = useAppStore(s => s.setRegistries);
  useEffect(() => {
    if (!configured || demo || !config) return;
    const instance = new HomeAssistantClient(config); client.current = instance; activeClient = instance;
    const unStatus = instance.onStatus((status, detail) => setConnection(status as ConnectionStatus, detail));
    const unState = instance.onState(change => { if (change.new_state) updateEntity(change.new_state); });
    const sync = async () => { try { const states = await instance.getStates(); setEntities(states); await instance.subscribeStates(); try { setRegistries(await instance.getRegistries()); } catch { /* Registry permission is optional; state sync remains available. */ } } catch (error) { setConnection('error', error instanceof Error ? error.message : 'La synchronisation a échoué.'); } };
    const unConnected = instance.onStatus(status => { if (status === 'connected') void sync(); }); instance.connect();
    return () => { unStatus(); unState(); unConnected(); instance.disconnect(); client.current = undefined; if (activeClient === instance) activeClient = undefined; };
  }, [config, configured, demo, setConnection, setEntities, setRegistries, updateEntity]);
  return client;
}
