// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { PowerCard } from './PowerCard';

const { getHistory } = vi.hoisted(() => ({ getHistory: vi.fn() }));
vi.mock('../../hooks/useHomeAssistant', () => ({ getHomeAssistantClient: () => ({ getHistory }) }));
afterEach(() => { cleanup(); getHistory.mockReset(); });
it('shows the selected live power without changing the existing dashboard selection', () => {
  useAppStore.getState().completeSetup(undefined, true);
  const dashboard = useAppStore.getState().dashboard;
  useAppStore.getState().setPowerEntity('sensor.maison_puissance');
  render(<PowerCard />);
  expect(screen.getByText('1,24 kW')).toBeTruthy();
  expect(useAppStore.getState().dashboard).toBe(dashboard);
});
it('lets the household explicitly hide demo power and choose a sensor again', () => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPowerEntity('');
  render(<PowerCard />);
  expect(screen.getByRole('button', { name: 'Choisir mon capteur' })).toBeTruthy();
  expect(screen.queryByText('1,24 kW')).toBeNull();
});
it('opens a demo curve on click and restores focus when dismissed with Escape', async () => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPowerEntity('sensor.maison_puissance');
  render(<PowerCard />);
  const card = screen.getByRole('button', { name: /Voir l’historique sur 24 h/ });
  expect(screen.queryByRole('dialog')).toBeNull();
  card.focus();
  fireEvent.click(card);
  expect(screen.getByRole('dialog', { name: 'Historique électrique sur 24 heures' })).toBeTruthy();
  expect(await screen.findByRole('img')).toBeTruthy();
  expect(screen.getByText('Courbe simulée · mode démonstration')).toBeTruthy();
  expect(getHistory).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(card);
});
it('fetches 24 hours only after opening and converts a kW sensor history to watts', async () => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPowerEntity('sensor.power');
  useAppStore.setState({ demo: false, connection: 'connected', entities: { 'sensor.power': { entity_id: 'sensor.power', state: '1.24', attributes: { unit_of_measurement: 'kW', friendly_name: 'Compteur' }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() } } });
  getHistory.mockResolvedValue({ 'sensor.power': [{ s: '.4', lu: Date.now() / 1000 - 3600 }, { s: '2.4', lu: Date.now() / 1000 - 30 }] });
  render(<PowerCard />);
  expect(getHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Voir l’historique sur 24 h/ }));
  expect(await screen.findByText('400 W')).toBeTruthy();
  expect(screen.getByText('2,4 kW')).toBeTruthy();
  const [ids, start, end] = getHistory.mock.calls[0];
  expect(ids).toEqual(['sensor.power']);
  expect(end - start).toBe(24 * 3_600_000);
  fireEvent.click(screen.getByRole('button', { name: 'Fermer l’historique électrique' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('shows recorder failures without displaying simulated measurements', async () => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPowerEntity('sensor.maison_puissance');
  useAppStore.setState({ demo: false, connection: 'connected' });
  getHistory.mockRejectedValue(new Error('Historique non disponible'));
  render(<PowerCard />);
  fireEvent.click(screen.getByRole('button', { name: /Voir l’historique sur 24 h/ }));
  expect(await screen.findByText('Historique non disponible')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByText('Courbe simulée · mode démonstration')).toBeNull();
});
