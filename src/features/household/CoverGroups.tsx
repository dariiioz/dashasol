import { useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { callHomeAssistantService } from '../../hooks/useHomeAssistant';
import { household } from '../../utils/household';
import { unavailable } from '../../utils/entities';

export function CoverGroups() {
  const entities = useAppStore(s => s.entities); const connection = useAppStore(s => s.connection); const demo = useAppStore(s => s.demo);
  const notify = useAppStore(s => s.notify); const [busy, setBusy] = useState(''); const sending = useRef(false);
  const run = async (id: string, close: boolean) => {
    if (sending.current || unavailable(entities[id]) || (!demo && connection !== 'connected')) return;
    if (useAppStore.getState().preferences.confirmGlobalActions && !window.confirm(close ? 'Fermer les volets de cet étage ?' : 'Ouvrir les volets de cet étage ?')) return;
    sending.current = true; setBusy(id);
    try { await callHomeAssistantService('script', 'turn_on', {}, { entity_id: id }); notify({ kind: 'success', text: 'Commande envoyée aux volets de l’étage.' }); }
    catch(e) { notify({ kind: 'error', text: e instanceof Error ? e.message : 'La commande a échoué.' }); }
    finally { sending.current = false; setBusy(''); }
  };
  return <div className="cover-groups">{household.covers.map(group => <div key={group.label}><b>{group.label}</b>{(['open', 'close'] as const).map(action => <button key={action} disabled={Boolean(busy) || unavailable(entities[group[action]]) || (!demo && connection !== 'connected')} onClick={() => void run(group[action], action === 'close')}>{busy === group[action] ? 'Envoi…' : `${action === 'open' ? 'Ouvrir' : 'Fermer'} le ${group.label.toLowerCase()}`}</button>)}</div>)}</div>;
}
