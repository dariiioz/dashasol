// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HassEntity } from '../../types/homeAssistant';
const { states } = vi.hoisted(() => ({ states: [{ entity_id: 'cover.volet_salon', state: 'open', attributes: { friendly_name: 'Volet salon' }, last_changed: '', last_updated: '' }, { entity_id: 'cover.volet_cuisine', state: 'closed', attributes: { friendly_name: 'Volet cuisine' }, last_changed: '', last_updated: '' }] as HassEntity[] }));
vi.mock('../../services/home-assistant/client', () => ({ HomeAssistantClient: class { private listener?: (status: string) => void; onStatus(listener: (status: string) => void) { this.listener = listener; return () => {}; } connect() { this.listener?.('connected'); } disconnect() {} async getStates() { return states; } } }));
const { Onboarding } = await import('./Onboarding');
describe('onboarding', () => {
  it('keeps every entity picked for a multi-valued mapping', async () => {
    render(<Onboarding />);
    fireEvent.change(screen.getByPlaceholderText('https://homeassistant.local:8123'), { target: { value: 'http://ha.test:8123' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), { target: { value: 'jeton' } });
    fireEvent.click(screen.getByRole('button', { name: /Tester et continuer/ }));
    await waitFor(() => screen.getByRole('button', { name: /Choisir/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choisir/ }));
    const salon = await screen.findByRole('button', { name: 'Volet salon' }); const cuisine = screen.getByRole('button', { name: 'Volet cuisine' });
    fireEvent.click(salon); fireEvent.click(cuisine);
    expect(salon.getAttribute('aria-pressed')).toBe('true'); expect(cuisine.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(salon);
    expect(salon.getAttribute('aria-pressed')).toBe('false'); expect(cuisine.getAttribute('aria-pressed')).toBe('true');
  });
});
