// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { defaultPreferences } from '../stores/config';
import { SettingsPage } from './settings/SettingsPage';
import { CoverQuickCommands } from './home/CoverQuickCommands';
import { callHomeAssistantService } from '../hooks/useHomeAssistant';
import { Navigation } from '../app/navigation';
import { HomePage } from './home/HomePage';
vi.mock('../hooks/useHomeAssistant', () => ({ callHomeAssistantService: vi.fn().mockResolvedValue(undefined), getHomeAssistantClient: () => undefined }));
vi.mock('../hooks/useWeather', () => ({ useWeather: () => ({ refresh: vi.fn() }) }));
vi.mock('../hooks/useVehicle', () => ({ useVehicle: () => ({ session: { phase: 'disconnected' }, retry: vi.fn() }) }));
vi.mock('./weather/WeatherScene', () => ({ WeatherScene: () => null }));
vi.mock('./assistant/VoiceAssistant', () => ({ VoiceAssistant: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  useAppStore.getState().completeSetup(undefined, true); useAppStore.setState({ preferences: { ...defaultPreferences, confirmGlobalActions: false }, spotify: {}, activePage: 'home' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('does not create an undefined naming row after associating a person', () => {
  const dashboard = useAppStore.getState().dashboard;
  useAppStore.getState().setDashboard({ ...dashboard, people: { Aymeric: 'person.test' } });
  render(<SettingsPage />); fireEvent.click(screen.getByRole('tab', { name: 'Équipements' })); fireEvent.click(screen.getByText('Renommer les équipements'));
  expect(screen.queryByRole('textbox', { name: 'Nom affiché pour undefined' })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Nom affiché pour person.test' })).toBeTruthy();
});
it('uses the explicit cover command even when a predefined script exists', async () => {
  const store = useAppStore.getState(); const entity = (entity_id: string) => ({ entity_id, state: 'off', attributes: {}, last_changed: '', last_updated: '' });
  useAppStore.setState({ demo: false, connection: 'connected', entities: { ...store.entities, 'script.ouvrir_volets_haut': entity('script.ouvrir_volets_haut'), 'script.chosen': entity('script.chosen') }, dashboard: { ...store.dashboard, coverCommands: { upperOpen: 'script.chosen' } } });
  render(<CoverQuickCommands />); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir volets haut' }));
  await waitFor(() => expect(callHomeAssistantService).toHaveBeenCalledWith('script', 'turn_on', {}, { entity_id: ['script.chosen'] }));
});
it('does not silently fall back when an explicit command disappears', () => {
  const store = useAppStore.getState(); useAppStore.setState({ dashboard: { ...store.dashboard, coverCommands: { upperOpen: 'script.missing' } } });
  render(<CoverQuickCommands />);
  expect((screen.getByRole('button', { name: 'Ouvrir volets haut' }) as HTMLButtonElement).disabled).toBe(true);
});
it('reaches a house page in two taps with only five primary destinations', () => {
  render(<Navigation />); expect(screen.getByRole('navigation', { name: 'Navigation principale' }).querySelectorAll('button')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Maison' })); fireEvent.click(screen.getByRole('button', { name: 'Volets' }));
  expect(useAppStore.getState().activePage).toBe('covers'); expect(screen.queryByRole('dialog')).toBeNull();
});
it('persists hidden modules, density and card order from the home drawer', () => {
  const { container } = render(<HomePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Personnaliser l’accueil' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Afficher Personnes' }), { target: { value: 'hide' } });
  expect(screen.queryByRole('article', { name: 'Aymeric et Honorine' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
  fireEvent.click(screen.getByRole('button', { name: 'Monter Courses' }));
  expect(useAppStore.getState().preferences.home?.order.indexOf('shopping')).toBeLessThan(useAppStore.getState().preferences.home!.order.indexOf('people'));
  expect(container.querySelector('.home-layout')?.getAttribute('data-density')).toBe('compact');
});
it('uses compact connection shortcuts for unconfigured optional services', () => {
  useAppStore.setState({ demo: false }); render(<HomePage />);
  expect(screen.queryByRole('article', { name: 'Lecteur Spotify' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Connecter Spotify' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Connecter l’ID.4' })).toBeTruthy();
});
