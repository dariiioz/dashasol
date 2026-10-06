// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { ShoppingList } from './ShoppingList';
const { request, service } = vi.hoisted(() => ({ request: vi.fn(), service: vi.fn() }));
vi.mock('../../hooks/useHomeAssistant', () => ({ getHomeAssistantClient: () => ({ request }), callHomeAssistantService: service }));
afterEach(() => { cleanup(); request.mockReset(); service.mockReset(); });
const connect = () => useAppStore.setState({ demo: false, connection: 'connected', entities: { 'todo.liste_dachats': { entity_id: 'todo.liste_dachats', state: '1', attributes: {}, last_changed: '', last_updated: '' } } });
it('reads real items and marks one complete by UID only after a confirmed service response', async () => {
  connect(); request.mockResolvedValue({ response: { 'todo.liste_dachats': { items: [{ uid: 'uid-milk', summary: 'Lait', status: 'needs_action' }] } } }); service.mockResolvedValue(undefined);
  render(<ShoppingList />); expect(await screen.findByText('Lait')).toBeTruthy();
  expect(request.mock.calls[0][0].return_response).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(service).toHaveBeenCalledWith('todo', 'update_item', { item: 'uid-milk', status: 'completed' }, { entity_id: 'todo.liste_dachats' }));
});
it('preserves an article draft after an unsuccessful add', async () => {
  connect(); request.mockResolvedValue({ response: { 'todo.liste_dachats': { items: [] } } }); service.mockRejectedValue(new Error('Commande refusée'));
  render(<ShoppingList />); await screen.findByText('La liste est vide. Ajoutez votre premier article.');
  const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Pain' } }); fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect((input as HTMLInputElement).value).toBe('Pain');
});
it('does not issue write commands while offline', () => {
  connect(); useAppStore.setState({ connection: 'offline' }); render(<ShoppingList />);
  expect((screen.getByRole('button', { name: 'Ajouter' }) as HTMLButtonElement).disabled).toBe(true); expect(service).not.toHaveBeenCalled();
});
