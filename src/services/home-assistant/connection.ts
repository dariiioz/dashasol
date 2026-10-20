import { HomeAssistantClient } from './client';
import type { HassConfig } from '../../types/homeAssistant';
export function testHomeAssistantConnection(config: HassConfig, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new HomeAssistantClient(config);
    let settled = false;
    let unsubscribe = () => {};
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timeout); unsubscribe(); signal?.removeEventListener('abort', cancel); client.disconnect(); error ? reject(error) : resolve(); };
    const cancel = () => finish(new Error('Test annulé.'));
    const timeout = setTimeout(() => finish(new Error('Home Assistant ne répond pas. Vérifiez son adresse et votre réseau.')), 15000);
    unsubscribe = client.onStatus((status, detail) => { if (status === 'connected') queueMicrotask(() => finish()); else if (['auth_error', 'error', 'offline'].includes(status)) finish(new Error(detail || 'Connexion refusée par Home Assistant.')); });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel(); else client.connect();
  });
}
