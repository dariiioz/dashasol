// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomeAssistantConnection } from './HomeAssistantConnection';
import { testHomeAssistantConnection } from '../../services/home-assistant/connection';
import { useAppStore } from '../../stores/appStore';
vi.mock('../../services/home-assistant/connection', () => ({ testHomeAssistantConnection: vi.fn() }));
const config = { url: 'http://ha.local:8123', token: 'test-token', homeName: 'Maison test' };
beforeEach(() => { useAppStore.getState().completeSetup(config); vi.mocked(testHomeAssistantConnection).mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it('tests before replacing a connection and preserves names, selections and preferences', async () => {
  useAppStore.getState().setLabel('cover.test', 'Salon');
  const { dashboard, preferences } = useAppStore.getState();
  render(<HomeAssistantConnection />);
  fireEvent.click(screen.getByRole('button', { name: 'Modifier la connexion' }));
  fireEvent.change(screen.getByLabelText('Adresse Home Assistant'), { target: { value: 'http://new-ha.local:8123/' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tester et enregistrer' }));
  await waitFor(() => expect(useAppStore.getState().config?.url).toBe('http://new-ha.local:8123'));
  expect(testHomeAssistantConnection).toHaveBeenCalledWith({ ...config, url: 'http://new-ha.local:8123' }, expect.any(AbortSignal));
  expect(useAppStore.getState().labels['cover.test']).toBe('Salon');
  expect(useAppStore.getState().dashboard).toBe(dashboard); expect(useAppStore.getState().preferences).toBe(preferences);
});
it('keeps the current connection when the candidate is refused', async () => {
  vi.mocked(testHomeAssistantConnection).mockRejectedValue(new Error('Jeton refusé'));
  render(<HomeAssistantConnection />); fireEvent.click(screen.getByRole('button', { name: 'Modifier la connexion' }));
  fireEvent.change(screen.getByLabelText('Nouveau jeton'), { target: { value: 'candidate-token' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tester et enregistrer' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Jeton refusé');
  expect(useAppStore.getState().config).toEqual(config);
});
it('aborts cancellation and does not save a late successful result', async () => {
  let finish!: () => void; vi.mocked(testHomeAssistantConnection).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<HomeAssistantConnection />); fireEvent.click(screen.getByRole('button', { name: 'Modifier la connexion' }));
  fireEvent.change(screen.getByLabelText('Adresse Home Assistant'), { target: { value: 'http://candidate.local' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tester et enregistrer' }));
  const signal = vi.mocked(testHomeAssistantConnection).mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' })); finish();
  await waitFor(() => expect(signal?.aborted).toBe(true));
  expect(useAppStore.getState().config).toEqual(config);
});
