import { ConfirmationHost } from '../../components/ConfirmationHost';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomeQuickActions } from './HomeQuickActions';
import { useAppStore } from '../../stores/appStore';
import { callHomeAssistantService } from '../../hooks/useHomeAssistant';
vi.mock('../../hooks/useHomeAssistant', () => ({ callHomeAssistantService: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPreferences({ confirmGlobalActions: false });
  useAppStore.setState({ activePage: 'home' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows six floor commands, limits demo actions to the requested floor and restores focus', async () => {
  render(<HomeQuickActions>{null}</HomeQuickActions>);
  const launch = screen.getByRole('button', { name: 'Ouvrir les volets' });
  launch.focus(); fireEvent.click(launch);
  const dialog = within(await screen.findByRole('dialog', { name: 'Volets' }));
  expect(dialog.getAllByRole('button')).toHaveLength(7);
  expect(dialog.queryByRole('slider')).toBeNull();
  fireEvent.click(dialog.getByRole('button', { name: 'Ouvrir volets haut' }));
  expect(useAppStore.getState().entities['cover.volet_chambre'].attributes.current_position).toBe(100);
  expect(useAppStore.getState().entities['cover.volet_salon'].attributes.current_position).toBe(25);
  fireEvent.click(dialog.getByRole('button', { name: 'Fermer volets bas' }));
  expect(useAppStore.getState().entities['cover.volet_cuisine'].attributes.current_position).toBe(0);
  expect(useAppStore.getState().entities['cover.volet_chambre'].attributes.current_position).toBe(100);
  fireEvent.click(dialog.getByRole('button', { name: 'Tout fermer' }));
  expect(useAppStore.getState().entities['cover.volet_chambre'].attributes.current_position).toBe(0);
  expect(callHomeAssistantService).not.toHaveBeenCalled();
  expect(useAppStore.getState().activePage).toBe('home');
  fireEvent.click(dialog.getByRole('button', { name: 'Fermer volets' }));
  expect(document.activeElement).toBe(launch);
});
it('opens the doorbell panel without changing pages', async () => {
  render(<HomeQuickActions>{null}</HomeQuickActions>);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la sonnette' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Sonnette' }));
  await dialog.findByText(/Connecte ton compte Eufy/);
  expect(useAppStore.getState().activePage).toBe('home');
});

it('uses the existing floor script and disables commands without a target or a connection', async () => {
  const entity = { ...useAppStore.getState().entities['cover.volet_salon'], entity_id: 'script.fermer_volets_haut', state: 'off' };
  useAppStore.setState({ demo: false, connection: 'connected', entities: { ...useAppStore.getState().entities, [entity.entity_id]: entity } });
  render(<HomeQuickActions>{null}</HomeQuickActions>);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les volets' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Volets' }));
  expect((dialog.getByRole('button', { name: 'Fermer volets bas' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(dialog.getByRole('button', { name: 'Fermer volets haut' }));
  await waitFor(() => expect(callHomeAssistantService).toHaveBeenCalledWith('script', 'turn_on', {}, { entity_id: ['script.fermer_volets_haut'] }));
  useAppStore.setState({ connection: 'offline' });
  await waitFor(() => expect((dialog.getByRole('button', { name: 'Tout ouvrir' }) as HTMLButtonElement).disabled).toBe(true));
});
it('confirms group actions inside the drawer and allows cancellation', async () => {
  useAppStore.getState().setPreferences({ confirmGlobalActions: true });
  render(<><HomeQuickActions>{null}</HomeQuickActions><ConfirmationHost /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les volets' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Volets' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Tout fermer' }));
  expect(useAppStore.getState().entities['cover.volet_cuisine'].attributes.current_position).toBe(100);
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tout fermer ?' })).toBeNull());
  expect(dialog.getByRole('button', { name: 'Tout fermer' })).toBeTruthy();
  fireEvent.click(dialog.getByRole('button', { name: 'Tout fermer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
  await waitFor(() => expect(useAppStore.getState().entities['cover.volet_cuisine'].attributes.current_position).toBe(0));
});
