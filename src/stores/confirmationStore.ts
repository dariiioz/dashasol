import { create } from 'zustand';
export interface Confirmation { title: string; description?: string; confirmLabel?: string; danger?: boolean }
export const useConfirmationStore = create<{ request?: Confirmation; answer?: (accepted: boolean) => void }>(() => ({}));
export function confirmAction(request: Confirmation, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted || useConfirmationStore.getState().request) return Promise.resolve(false);
  return new Promise(resolve => {
    const cancel = () => { if (useConfirmationStore.getState().request === request) useConfirmationStore.getState().answer?.(false); };
    useConfirmationStore.setState({ request, answer: accepted => { signal?.removeEventListener('abort', cancel); useConfirmationStore.setState({ request: undefined, answer: undefined }); resolve(accepted); } });
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
