// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { confirmAction, useConfirmationStore } from './confirmationStore';
import { ConfirmationHost } from '../components/ConfirmationHost';
afterEach(() => { cleanup(); useConfirmationStore.getState().answer?.(false); });
it('focuses cancellation and resolves acceptance without a native dialog', async () => {
  const pending = confirmAction({ title: 'Appliquer ?', confirmLabel: 'Appliquer' });
  render(<ConfirmationHost />);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Annuler' }));
  fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
  expect(await pending).toBe(true); expect(screen.queryByRole('dialog')).toBeNull();
});
it('does not replace an existing confirmation and cancels an aborted operation', async () => {
  const controller = new AbortController(); const pending = confirmAction({ title: 'Première action' }, controller.signal);
  expect(await confirmAction({ title: 'Autre action' })).toBe(false);
  expect(useConfirmationStore.getState().request?.title).toBe('Première action');
  controller.abort(); expect(await pending).toBe(false); expect(useConfirmationStore.getState().request).toBeUndefined();
});
