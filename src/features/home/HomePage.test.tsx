// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { HomePage } from './HomePage';

vi.mock('../weather/WeatherScene', () => ({ WeatherScene: () => null }));
vi.mock('../assistant/VoiceAssistant', () => ({ VoiceAssistant: () => null }));
beforeEach(() => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.getState().setPreferences({ confirmGlobalActions: false });
});
afterEach(cleanup);
it('keeps the home summary and detailed weather out of the compact dashboard', () => {
  const dashboard = useAppStore.getState().dashboard;
  useAppStore.getState().setDashboard({ ...dashboard, updateEntities: [] });
  const { container } = render(<HomePage />);
  expect(container.querySelector('.house-summary')).toBeNull();
  expect(container.querySelector('.weather-metrics')).toBeNull();
  expect((screen.getByRole('button', { name: 'À jour' }) as HTMLButtonElement).disabled).toBe(true);
});
it('still opens selected updates from the compact energy strip', () => {
  const dashboard = useAppStore.getState().dashboard;
  useAppStore.getState().setDashboard({ ...dashboard, updateEntities: [dashboard.updateEntities[0]] });
  render(<HomePage />);
  fireEvent.click(screen.getByRole('button', { name: '1 mise à jour' }));
  expect(screen.getByRole('dialog', { name: 'Mises à jour disponibles' })).toBeTruthy();
  expect(screen.getByText('1 mise à jour disponible')).toBeTruthy();
});
