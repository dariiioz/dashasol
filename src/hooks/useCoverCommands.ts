import { useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { callHomeAssistantService } from './useHomeAssistant';
import { coverCommandKeys, resolveCoverCommand } from '../services/home-assistant/coverCommands';
import { demoAutomationTargets } from '../services/home-assistant/demo';
import type { CoverCommandKey } from '../types/homeAssistant';
import { confirmAction } from '../stores/confirmationStore';
export function useCoverCommands() {
  const dashboard = useAppStore(s => s.dashboard); const entities = useAppStore(s => s.entities);
  const demo = useAppStore(s => s.demo); const connection = useAppStore(s => s.connection);
  const [sending, setSending] = useState(false); const busy = useRef(false);
  const commands = coverCommandKeys.map(key => resolveCoverCommand(key, dashboard, entities, demo));
  const run = async (key: CoverCommandKey) => {
    if (busy.current) return false;
    busy.current = true;
    try {
      const initial = useAppStore.getState();
      const request = resolveCoverCommand(key, initial.dashboard, initial.entities, initial.demo);
      if (!request.targets.length || !initial.demo && initial.connection !== 'connected') return false;
      if (initial.preferences.confirmGlobalActions && !await confirmAction({ title: `${request.label} ?`, description: 'Appliquer cette commande aux volets du groupe sélectionné.', confirmLabel: 'Confirmer' })) return false;
      const store = useAppStore.getState();
      if (store.config !== initial.config || store.demo !== initial.demo) throw new Error('La connexion a changé. Vérifiez la commande avant de réessayer.');
      const command = resolveCoverCommand(key, store.dashboard, store.entities, store.demo);
      if (!command.targets.length || !store.demo && store.connection !== 'connected') throw new Error('Cette commande est devenue indisponible.');
      if (JSON.stringify(command) !== JSON.stringify(request)) throw new Error('La configuration a changé. Vérifiez la commande avant de réessayer.');
      setSending(true);
      if (store.demo) {
        const targets = command.domain === 'cover' ? command.targets : command.targets.flatMap(id => demoAutomationTargets[id] ?? []);
        targets.forEach(id => { const entity = store.entities[id]; if (entity) store.updateEntity({ ...entity, state: command.opening ? 'open' : 'closed', attributes: { ...entity.attributes, current_position: command.opening ? 100 : 0 } }); });
      } else await callHomeAssistantService(command.domain, command.service, {}, { entity_id: command.targets });
      store.notify({ kind: 'success', text: 'Commande envoyée.' }); return true;
    } catch (error) { useAppStore.getState().notify({ kind: 'error', text: error instanceof Error ? error.message : 'La commande a été refusée.' }); return false; }
    finally { busy.current = false; setSending(false); }
  };
  return { commands, run, sending, connected: demo || connection === 'connected' };
}
