// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { HomePage } from './HomePage';

vi.mock('../weather/WeatherScene', () => ({ WeatherScene: () => null }));
vi.mock('../assistant/VoiceAssistant', () => ({ VoiceAssistant: () => null }));
beforeEach(() => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPreferences({ confirmGlobalActions: false });
});
afterEach(cleanup);
it('summarizes only selected equipment and hides unselected updates', () => {
  const dashboard = useAppStore.getState().dashboard;
  useAppStore.getState().setDashboard({ ...dashboard, coverEntities: [{ entityId: 'cover.volet_chambre', enabled: true, order: 0 }], climateEntities: [], updateEntities: [] });
  const { container } = render(<HomePage />);
  expect(container.querySelector('.summary-numbers')?.textContent).toContain('0volets ouvertsReposchauffage');
  expect((screen.getByRole('button', { name: /Tout est calme/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: /mises à jour/ })).toBeNull();
});
it('opens the simulated upper floor covers from a quick command', async () => {
  render(<HomePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le haut' }));
  await waitFor(() => expect(useAppStore.getState().entities['cover.volet_chambre'].attributes.current_position).toBe(100));
  expect(useAppStore.getState().entities['cover.volet_salon'].attributes.current_position).toBe(25);
});
