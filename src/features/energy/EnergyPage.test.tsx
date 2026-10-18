// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EnergyPage } from './EnergyPage';
import { useAppStore } from '../../stores/appStore';
import { slots } from '../../services/energy/model';
import { useEnergyStore } from '../../stores/energyStore';
import type { HassEntity } from '../../types/homeAssistant';
import { disconnected } from '../../services/vehicle/client';

const start = Date.parse('2026-10-18T12:00:00Z');
vi.mock('../../hooks/useClock', () => ({ useClock: () => new Date('2026-10-18T14:00:00Z') }));
vi.mock('../../hooks/useVehicle', () => ({ useVehicle: () => ({ session: disconnected }) }));
vi.mock('../../hooks/useCharger', () => ({ useCharger: () => ({ configured: true, online: true, data: null, history: { startedAt: start, sessions: [], active: null } }), chargerLabel: () => 'Au repos' }));
vi.mock('../../hooks/useEnergyPrices', () => ({ useEnergyPrices: () => ({ imported: {}, rates: { blueHC: .1, blueHP: .2 } }) }));
vi.mock('../../hooks/useEnergy', () => ({ useEnergy: () => ({ status: 'ready', data: Object.fromEntries(slots.map((s, i) => [s.id, [{ start, end: start + 300000, change: i === 1 ? 2 : 0 }]])), rates: {}, start, end: start + 300000, reload: vi.fn() }) }));
beforeEach(() => {
  useAppStore.setState({ configured: true, demo: false, connection: 'connected', mapping: { tempoToday: 'sensor.old' }, entities: {
    'sensor.rte_tempo_couleur_actuelle': { entity_id: 'sensor.rte_tempo_couleur_actuelle', state: 'Bleu', attributes: {} } as HassEntity,
    'sensor.lixee_ntarf': { entity_id: 'sensor.lixee_ntarf', state: '2', attributes: {} } as HassEntity,
  } });
  useEnergyStore.setState({ rates: {} });
});
afterEach(cleanup);
it('shows recorded energy and its tariff estimate using the real RTE fallback', () => {
  render(<EnergyPage />);
  expect(screen.getAllByText(/0,40\s€/)[0]).toBeTruthy();
  expect(screen.getByText('Bleu')).toBeTruthy();
  expect(screen.getByText('Estimation · hors abonnement')).toBeTruthy();
});
it('compares a planned recharge without issuing a vehicle or charger command', () => {
  render(<EnergyPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Recharges' }));
  expect(screen.getByText('La prochaine recharge apparaîtra ici.')).toBeTruthy();
  expect(screen.getByText(/2,00\s€/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Énergie à ajouter pour la simulation'), { target: { value: '20' } });
  expect(screen.getByText(/4,00\s€/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /démarrer|arrêter/i })).toBeNull();
});
it('saves explicit local tariff overrides from the dialog', () => {
  render(<EnergyPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Configurer les tarifs Tempo' }));
  const dialog = screen.getByRole('dialog', { name: 'Tarifs Tempo' });
  expect(dialog.parentElement?.parentElement).toBe(document.body);
  fireEvent.change(screen.getByLabelText('Rouge · HP'), { target: { value: '.7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  expect(useEnergyStore.getState().rates.redHP).toBe(.7);
  expect(screen.queryByRole('dialog')).toBeNull();
});
