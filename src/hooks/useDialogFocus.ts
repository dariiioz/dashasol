import { useEffect, useRef } from 'react';

/** Keep keyboard navigation in the open dialog and return focus to its launcher. */
export function useDialogFocus() {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    if (!node) return;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    const first = node.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)');
    first?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); node.focus(); return; }
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', trap);
    return () => { node.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, []);
  return dialog;
}
