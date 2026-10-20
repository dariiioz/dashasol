// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HassEntity } from '../../types/homeAssistant';
const { scenario, states } = vi.hoisted(() => ({ scenario: { fail: false }, states: [{ entity_id: 'cover.volet_salon', state: 'open', attributes: { friendly_name: 'Volet salon' }, last_changed: '', last_updated: '' }, { entity_id: 'cover.volet_cuisine', state: 'closed', attributes: { friendly_name: 'Volet cuisine' }, last_changed: '', last_updated: '' }] as HassEntity[] }));
vi.mock('../../services/home-assistant/client', () => ({ HomeAssistantClient: class { private listener?: (status: string) => void; onStatus(listener: (status: string) => void) { this.listener = listener; return () => {}; } connect() { this.listener?.(scenario.fail ? 'auth_error' : 'connected'); } disconnect() {} async getStates() { return states; } } }));
const { Onboarding } = await import('./Onboarding');
afterEach(() => { cleanup(); scenario.fail = false; });
describe('onboarding', () => {
  it('keeps every entity picked for a multi-valued mapping', async () => {
    render(<Onboarding />);
    fireEvent.change(screen.getByPlaceholderText('https://homeassistant.local:8123'), { target: { value: 'http://ha.test:8123' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), { target: { value: 'jeton' } });
    fireEvent.click(screen.getByRole('button', { name: /Tester et continuer/ }));
    await waitFor(() => screen.getByRole('heading', { name: 'Choisir les équipements' }));
    expect(screen.queryByRole('combobox', { name: 'Météo' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Indice UV' })).toBeNull();
    const salon = await screen.findByRole('button', { name: 'Volet salon' }); const cuisine = screen.getByRole('button', { name: 'Volet cuisine' });
    fireEvent.click(salon); fireEvent.click(cuisine);
    expect(salon.getAttribute('aria-pressed')).toBe('true'); expect(cuisine.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(salon);
    expect(salon.getAttribute('aria-pressed')).toBe('false'); expect(cuisine.getAttribute('aria-pressed')).toBe('true');
  });
  it('stays on connection after a rejected token and lets the user retry', async () => {
    scenario.fail = true;
    render(<Onboarding />);
    fireEvent.change(screen.getByPlaceholderText('https://homeassistant.local:8123'), { target: { value: 'http://ha.test:8123' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), { target: { value: 'jeton' } });
    fireEvent.click(screen.getByRole('button', { name: /Tester et continuer/ }));
    expect(screen.getByRole('heading', { name: 'Connecter la maison' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Choisir les équipements' })).toBeNull();
    expect((screen.getByRole('button', { name: /Tester et continuer/ }) as HTMLButtonElement).disabled).toBe(false);
    scenario.fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Tester et continuer/ }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choisir les équipements' })).toBeTruthy());
  });
});
