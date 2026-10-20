// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { HomePeopleCard } from './HomePeopleCard';
import { personDetails } from './people';
import { useAppStore } from '../../stores/appStore';
import type { HassEntity, HassRegistries } from '../../types/homeAssistant';

const entity = (entity_id: string, state: string, attributes = {}): HassEntity => ({ entity_id, state, attributes, last_changed: '2026-10-20T08:00:00Z', last_updated: '2026-10-20T10:00:00Z' });
const entities = Object.fromEntries([
  entity('person.family_a', 'home', { friendly_name: 'CAPPELLE Aymeric', source: 'device_tracker.phone_a' }),
  entity('person.family_h', 'Travail', { friendly_name: 'EHRLICH Honorine', source: 'device_tracker.phone_h', gps_accuracy: 12 }),
  entity('device_tracker.phone_a', 'home', { friendly_name: 'Téléphone Aymeric', battery_level: 0 }),
  entity('device_tracker.phone_h', 'not_home', { friendly_name: 'Téléphone Honorine' }),
  entity('sensor.battery_h', '78', { device_class: 'battery', unit_of_measurement: '%' }),
  entity('sensor.unrelated', '10', { device_class: 'battery', unit_of_measurement: '%' }),
  entity('binary_sensor.charging_h', 'on', { device_class: 'battery_charging' }),
].map(entity => [entity.entity_id, entity]));
const registries: HassRegistries = { devices: [], areas: [], entities: [
  { entity_id: 'device_tracker.phone_h', device_id: 'phone-h' },
  { entity_id: 'sensor.battery_h', device_id: 'phone-h' },
  { entity_id: 'binary_sensor.charging_h', device_id: 'phone-h' },
  { entity_id: 'sensor.unrelated', device_id: 'other' },
] };
beforeEach(() => {
  useAppStore.getState().completeSetup(undefined, true);
  useAppStore.setState({ entities, registries, activePage: 'home' });
});
afterEach(cleanup);

it('recognizes surnames before given names and only links the right device’s sensors', () => {
  expect(personDetails('Aymeric', entities, registries)).toMatchObject({ status: 'À la maison', battery: 0 });
  expect(personDetails('Honorine', entities, registries)).toMatchObject({ status: 'Travail', battery: 78, charging: true, accuracy: 12 });
  expect(personDetails('Honorine', entities).battery).toBeUndefined();
});
it('does not guess between ambiguous profiles or treat missing data as presence', () => {
  const duplicate = { ...entities, 'person.other': entity('person.other', 'home', { friendly_name: 'Aymeric Autre' }) };
  expect(personDetails('Aymeric', duplicate).person).toBeUndefined();
  expect(personDetails('Aymeric', {}).status).toBe('Indisponible');
  expect(personDetails('Aymeric', duplicate, undefined, 'person.family_a').status).toBe('À la maison');
});
it('opens details, switches people, updates live and restores focus without leaving home', () => {
  render(<HomePeopleCard />);
  const launch = screen.getByRole('button', { name: 'Voir les infos de Aymeric' });
  launch.focus(); fireEvent.click(launch);
  const dialog = within(screen.getByRole('dialog', { name: 'Aymeric' }));
  expect(dialog.getByText('0 %')).toBeTruthy();
  fireEvent.click(dialog.getByRole('button', { name: 'Honorine' }));
  const honorine = within(screen.getByRole('dialog', { name: 'Honorine' }));
  expect(honorine.getByText('78 % · En charge')).toBeTruthy();
  expect(honorine.getByText('± 12 m')).toBeTruthy();
  fireEvent.click(honorine.getByRole('button', { name: 'Fermer honorine' }));
  expect(document.activeElement).toBe(launch);
  expect(useAppStore.getState().activePage).toBe('home');
});
it('shows a disconnected state instead of live presence and explains absent profiles', () => {
  useAppStore.setState({ demo: false, connection: 'offline', entities: {} });
  render(<HomePeopleCard />);
  expect(screen.getAllByText('Hors connexion')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Voir les infos de Aymeric' }));
  expect(screen.getByText(/Aucune personne partagée/)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('déconnecté');
});
