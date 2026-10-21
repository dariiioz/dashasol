// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { TemperaturesPage } from './TemperaturesPage';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('pairs room humidity automatically and charts humidity with percent units', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  useAppStore.getState().completeSetup(undefined, true);
  const t = 'sensor.therm_salon_temperature'; const h = 'sensor.therm_salon_humidity';
  const make = (entity_id: string, state: string, unit: string) => ({ entity_id, state, attributes: { unit_of_measurement: unit }, last_changed: '', last_updated: '' });
  useAppStore.setState({ rooms: [], entities: { [t]: make(t, '21', '°C'), [h]: make(h, '62', '%'), 'number.therm_salon_comfort_humidity_min': make('number.therm_salon_comfort_humidity_min', '40', '%'), 'number.therm_salon_comfort_humidity_max': make('number.therm_salon_comfort_humidity_max', '60', '%') } });
  useAppStore.getState().setDashboard({ ...useAppStore.getState().dashboard, temperatureEntities: [{ entityId: t, enabled: true, order: 0 }] });
  render(<TemperaturesPage />); expect(screen.getByText('62 %')).toBeTruthy(); expect(screen.getByText('Au-dessus de votre seuil d’humidité')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Humidité' }));
  const chart = await screen.findByRole('img'); expect(chart.textContent).toContain('%'); expect(chart.textContent).not.toContain('°');
});
