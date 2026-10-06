// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../stores/appStore';
import { HeatingPage } from './heating/HeatingPage';
import { CoversPage } from './covers/CoversPage';
import { defaultPreferences } from '../stores/config';
import type { HassEntity } from '../types/homeAssistant';

const { callService } = vi.hoisted(() => ({ callService: vi.fn() }));
vi.mock('../hooks/useHomeAssistant', () => ({ callHomeAssistantService: callService }));
const entity = (entity_id: string, state: string, attributes: Record<string, unknown>): HassEntity => ({ entity_id, state, attributes, last_changed: '', last_updated: '' });
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  callService.mockReset().mockResolvedValue([]);
  useAppStore.setState({ demo: false, connection: 'connected', notification: undefined, labels: {}, preferences: { ...defaultPreferences, confirmGlobalActions: false }, entities: {
    'climate.salon': entity('climate.salon', 'heat', { temperature: 20, current_temperature: 19, min_temp: 7, max_temp: 30, target_temp_step: 1, friendly_name: 'Salon' }),
    'cover.salon': entity('cover.salon', 'open', { current_position: 35, friendly_name: 'Salon' }),
    'cover.absent': entity('cover.absent', 'unavailable', { friendly_name: 'Absent' })
  }, dashboard: { temperatureEntities: [], mediaEntities: [], updateEntities: [], climateEntities: [{ entityId: 'climate.salon', enabled: true, order: 0 }], coverEntities: [{ entityId: 'cover.salon', enabled: true, order: 0 }, { entityId: 'cover.absent', enabled: true, order: 1 }] } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('house controls', () => {
  it('commits a heating slider from the keyboard once, even when it also loses focus', async () => {
    render(<HeatingPage />);
    const slider = screen.getByRole('slider', { name: 'Consigne Salon' });
    fireEvent.change(slider, { target: { value: '22' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' }); fireEvent.blur(slider);
    await waitFor(() => expect(callService).toHaveBeenCalledTimes(1));
    expect(callService).toHaveBeenCalledWith('climate', 'set_temperature', { temperature: 22 }, { entity_id: 'climate.salon' });
  });
  it('rolls back a rejected temperature and exposes the failure', async () => {
    callService.mockRejectedValue(new Error('Connexion interrompue'));
    render(<HeatingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter la consigne Salon' }));
    await waitFor(() => expect(useAppStore.getState().notification?.kind).toBe('error'));
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('20');
    expect(useAppStore.getState().notification?.text).toBe('Connexion interrompue');
  });
  it('disables heating commands offline', () => {
    useAppStore.setState({ connection: 'offline' }); render(<HeatingPage />);
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter la consigne Salon' }));
    expect(callService).not.toHaveBeenCalled();
  });
  it('excludes unavailable covers from a global command', async () => {
    render(<CoversPage />); fireEvent.click(screen.getByRole('button', { name: 'Tout fermer' }));
    await waitFor(() => expect(callService).toHaveBeenCalledWith('cover', 'close_cover', {}, { entity_id: ['cover.salon'] }));
    expect((screen.getByRole('button', { name: 'Ouvrir Absent' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('keeps the cover position when stopping in demo mode', async () => {
    useAppStore.setState({ demo: true }); render(<CoversPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Stopper Salon' }));
    await waitFor(() => expect(useAppStore.getState().notification?.text).toBe('Arrêt demandé.'));
    expect(useAppStore.getState().entities['cover.salon'].attributes.current_position).toBe(35);
    expect(callService).not.toHaveBeenCalled();
  });
});
