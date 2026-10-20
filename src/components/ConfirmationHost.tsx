import { useEffect } from 'react';
import { useConfirmationStore } from '../stores/confirmationStore';
import { QuickDrawer } from './QuickDrawer';
export function ConfirmationHost() {
  const { request, answer } = useConfirmationStore();
  useEffect(() => () => useConfirmationStore.getState().answer?.(false), []);
  return request ? <QuickDrawer title={request.title} placement="bottom" initialFocusSelector="[data-confirm-cancel]" onClose={() => answer?.(false)}><div className="app-confirmation">{request.description && <p>{request.description}</p>}<div><button data-confirm-cancel onClick={() => answer?.(false)}>Annuler</button><button className={request.danger ? 'danger' : 'selected'} onClick={() => answer?.(true)}>{request.confirmLabel ?? 'Confirmer'}</button></div></div></QuickDrawer> : null;
}
