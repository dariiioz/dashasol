// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { CoverGroups } from './CoverGroups';
const { service } = vi.hoisted(() => ({ service: vi.fn() }));
vi.mock('../../hooks/useHomeAssistant', () => ({ callHomeAssistantService: service }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); service.mockReset(); });
it('sends the exact lower-floor closing script and never commands individual covers implicitly', async () => {
  const id = 'script.fermeture_de_tout_les_volets_du_bas';
  useAppStore.setState({ demo: false, connection: 'connected', entities: { [id]: { entity_id: id, state: 'off', attributes: {}, last_changed: '', last_updated: '' } } });
  useAppStore.getState().setPreferences({ confirmGlobalActions: true });
  vi.spyOn(window, 'confirm').mockReturnValue(true); service.mockResolvedValue(undefined);
  render(<CoverGroups />); fireEvent.click(screen.getByRole('button', { name: 'Fermer le bas' }));
  await waitFor(() => expect(service).toHaveBeenCalledWith('script', 'turn_on', {}, { entity_id: id }));
  expect(service).toHaveBeenCalledTimes(1);
});
it('disables group controls when disconnected', () => {
  useAppStore.setState({ demo: false, connection: 'offline', entities: {} }); render(<CoverGroups />);
  for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
});
