// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { usePlannerStore, type PlannerEvent } from '../../stores/plannerStore';
import { PlannerCards } from './PlannerCards';
import { PlannerPage } from '../planner/PlannerPage';
vi.mock('../../hooks/useClock', () => ({ useClock: () => new Date(2026, 9, 20, 12) }));
beforeEach(() => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.setState({ activePage: 'home' });
  usePlannerStore.setState({ view: 'calendar', selectedDate: '', todoSource: 'local', calendarSource: 'local', items: [], events: [] });
});
afterEach(cleanup);
const event = (uid: string, summary: string, start: string, end: string, allDay = false): PlannerEvent => ({ uid, summary, start, end, allDay });
it('shows past and upcoming events on their dates, including an exclusive all-day end', () => {
  usePlannerStore.setState({ events: [event('past', 'Dentiste', '2026-10-07T09:00:00', '2026-10-07T10:00:00'), event('trip', 'En famille', '2026-10-24', '2026-10-27', true)] });
  render(<PlannerCards />);
  expect(within(screen.getByRole('button', { name: /mercredi 7 octobre 2026/ })).getByText('Dentiste')).toBeTruthy();
  for (const day of [24, 25, 26]) expect(within(screen.getByRole('button', { name: new RegExp(`${day} octobre 2026`) })).getByText('En famille')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: /27 octobre 2026/ })).queryByText('En famille')).toBeNull();
});
it('keeps dense days discoverable and opens the selected date after a year change', () => {
  usePlannerStore.setState({ events: Array.from({ length: 4 }, (_, i) => event(String(i), `Rendez-vous ${i}`, `2026-10-20T${10 + i}:00:00`, `2026-10-20T${11 + i}:00:00`)) });
  const home = render(<PlannerCards />);
  const today = screen.getByRole('button', { name: /20 octobre 2026 · 4 événements/ });
  expect(within(today).getByText('+2')).toBeTruthy();
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
  expect(screen.getByText('janvier 2027')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /vendredi 1 janvier 2027/ }));
  expect(useAppStore.getState().activePage).toBe('planner');
  expect(usePlannerStore.getState().selectedDate).toBe('2027-01-01');
  home.unmount(); render(<PlannerPage />);
  expect(screen.getByText('1 janvier')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'vendredi 1 janvier 2027' }).getAttribute('aria-pressed')).toBe('true');
});
it('shows all pending items and opens the complete list in a drawer', async () => {
  usePlannerStore.setState({ items: ['Pain', 'Tomates', 'Café'].map(summary => ({ uid: summary, summary, status: 'needs_action' as const })) });
  render(<PlannerCards />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  expect(screen.queryByRole('textbox', { name: 'Article à ajouter' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cocher Pain' }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Cocher Café' })).toBeTruthy());
  expect(useAppStore.getState().activePage).toBe('home');
  fireEvent.click(screen.getByRole('button', { name: 'Courses 2' }));
  expect(screen.getByRole('dialog', { name: 'Courses' })).toBeTruthy();
  expect(useAppStore.getState().activePage).toBe('home');
});

it('adds successive items in the drawer, preserves an unfinished draft and restores focus', async () => {
  render(<PlannerCards />);
  const open = screen.getByRole('button', { name: 'Ajouter aux courses' });
  open.focus(); fireEvent.click(open);
  const dialog = within(screen.getByRole('dialog', { name: 'Courses' }));
  const input = dialog.getByRole('textbox', { name: 'Article à ajouter' }) as HTMLInputElement;
  expect(document.activeElement).toBe(input);
  for (const name of ['Lait', 'Pain']) {
    fireEvent.change(input, { target: { value: name } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.value).toBe(''));
    expect(document.activeElement).toBe(input);
  }
  expect(usePlannerStore.getState().items.map(item => item.summary)).toEqual(['Lait', 'Pain']);
  fireEvent.change(input, { target: { value: 'Brouillon' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(open);
  fireEvent.click(open);
  expect((screen.getByRole('textbox', { name: 'Article à ajouter' }) as HTMLInputElement).value).toBe('Brouillon');
});
it('confirms clearing all items, including checked ones, without removing later additions', async () => {
  usePlannerStore.setState({ items: [{ uid: 'a', summary: 'Pain', status: 'needs_action' }, { uid: 'b', summary: 'Lait', status: 'completed' }] });
  render(<PlannerCards />);
  fireEvent.click(screen.getByRole('button', { name: 'Vider les courses' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Vider la liste ?' }));
  expect(document.activeElement).toBe(dialog.getByRole('button', { name: 'Annuler' }));
  expect(usePlannerStore.getState().items).toHaveLength(2);
  // An item arriving after confirmation opened was not part of the reviewed list.
  usePlannerStore.getState().addItem('Pommes');
  fireEvent.click(dialog.getByRole('button', { name: 'Vider la liste' }));
  await waitFor(() => expect(usePlannerStore.getState().items.map(item => item.summary)).toEqual(['Pommes']));
  expect(await screen.findByRole('dialog', { name: 'Courses' })).toBeTruthy();
});
it('does not clear anything when the user cancels', () => {
  usePlannerStore.setState({ items: [{ uid: 'a', summary: 'Pain', status: 'needs_action' }] });
  render(<PlannerCards />);
  fireEvent.click(screen.getByRole('button', { name: 'Vider les courses' }));
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  expect(usePlannerStore.getState().items).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'Article à ajouter' })).toBeTruthy();
});
