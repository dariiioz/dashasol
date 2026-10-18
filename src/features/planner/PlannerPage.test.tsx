// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import { PlannerPage } from './PlannerPage';
vi.mock('../../hooks/useHomeAssistant', () => ({ getHomeAssistantClient: () => undefined }));
beforeEach(() => { useAppStore.setState({ demo: false, entities: {}, connection: 'offline' }); usePlannerStore.setState({ view: 'shopping', todoSource: 'local', calendarSource: 'local', items: [], events: [] }); });
afterEach(cleanup);
it('adds and checks a local shopping item without losing it on remount', async () => {
  const page = render(<PlannerPage />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Article à ajouter' }), { target: { value: 'Pommes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’article' }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Cocher Pommes' })).toBeTruthy());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cocher Pommes' }));
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Cocher Pommes' })).toBeNull());
  page.unmount(); render(<PlannerPage />);
  fireEvent.click(screen.getByRole('button', { name: /Afficher les articles cochés/ }));
  expect(screen.getByRole('checkbox', { name: 'Cocher Pommes' }).getAttribute('aria-checked')).toBe('true');
});
it('creates an all-day local event and keeps the inclusive last day in the UI', async () => {
  usePlannerStore.setState({ view: 'calendar' }); render(<PlannerPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter un événement' }));
  fireEvent.change(screen.getByLabelText('Événement'), { target: { value: 'Anniversaire' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Toute la journée' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’événement' }));
  await waitFor(() => expect(screen.getByText('Anniversaire')).toBeTruthy());
  const event = usePlannerStore.getState().events[0];
  expect(event.allDay).toBe(true);
  expect(Date.parse(event.end) - Date.parse(event.start)).toBe(86400000);
});
it('keeps a read-only HA calendar disabled rather than writing locally', () => {
  useAppStore.setState({ connection: 'connected', entities: { 'calendar.tempo': { entity_id: 'calendar.tempo', state: 'off', attributes: { friendly_name: 'Tempo', supported_features: 0 }, last_changed: '', last_updated: '' } } });
  usePlannerStore.setState({ view: 'calendar', calendarSource: 'calendar.tempo' }); render(<PlannerPage />);
  expect((screen.getByRole('button', { name: 'Ajouter un événement' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/lecture seule/)).toBeTruthy();
});
