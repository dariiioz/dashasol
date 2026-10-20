// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { SettingsPage } from './SettingsPage';
beforeEach(() => useAppStore.getState().completeSetup(undefined, true));
afterEach(cleanup);
it('keeps display preferences while navigating between settings sections', () => {
  render(<SettingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Clair' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Équipements' }));
  expect(screen.queryByRole('button', { name: 'Clair' })).toBeNull();
  expect(screen.getByRole('button', { name: /Températures.*sélectionnées/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Écran' }));
  expect(screen.getByRole('button', { name: 'Clair' }).getAttribute('aria-pressed')).toBe('true');
});
it('supports keyboard tabs and links account setup to the matching screen', () => {
  render(<SettingsPage />);
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Écran' }), { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Système' }).getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Système' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Connexions' }));
  fireEvent.click(screen.getByRole('button', { name: /Volkswagen/ }));
  expect(useAppStore.getState().activePage).toBe('vehicle');
});
