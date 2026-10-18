// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { disconnected, type VehicleData } from '../../services/vehicle/client';
import { VehiclePage } from './VehiclePage';
const mock = vi.hoisted(() => ({ session: {} as unknown, login: vi.fn(), otp: vi.fn() }));
vi.mock('./VehicleScene', () => ({ VehicleScene: () => <div data-testid="vehicle-scene" /> }));
vi.mock('../../hooks/useVehicle', () => ({ useVehicle: () => ({ session: mock.session, busy: false, login: mock.login, otp: mock.otp, refresh: vi.fn(), select: vi.fn(), logout: vi.fn() }) }));
beforeEach(() => { useAppStore.setState({ demo: false }); mock.session = disconnected; mock.login.mockResolvedValue(false); mock.otp.mockResolvedValue(false); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('clears the password immediately on submission without storing it in localStorage', () => {
 render(<VehiclePage />);
 fireEvent.change(screen.getByLabelText('E-mail Volkswagen'), { target: { value: 'test@example.org' } });
 const password = screen.getByLabelText('Mot de passe') as HTMLInputElement;
 fireEvent.change(password, { target: { value: 'private-test-password' } });
 fireEvent.submit(screen.getByRole('button', { name: 'Connecter Volkswagen' }).closest('form')!);
 expect(mock.login).toHaveBeenCalledWith('test@example.org', 'private-test-password'); expect(password.value).toBe('');
 expect(JSON.stringify(localStorage)).not.toContain('private-test-password');
});
it('shows only the email OTP challenge after Volkswagen requests it', () => {
 mock.session = { ...disconnected, phase: 'otp_required' };
 render(<VehiclePage />);
 expect(screen.queryByLabelText('Mot de passe')).toBeNull();
 fireEvent.change(screen.getByLabelText('Code reçu par e-mail'), { target: { value: '123456' } });
 fireEvent.submit(screen.getByRole('button', { name: 'Valider le code' }).closest('form')!);
 expect(mock.otp).toHaveBeenCalledWith('123456'); expect((screen.getByLabelText('Code reçu par e-mail') as HTMLInputElement).value).toBe('');
});

it('offers the exact official consent screen and a French account link without asking for another OTP', () => {
 mock.session = { ...disconnected, phase: 'consent_required', consentUrl: 'https://identity.vwgroup.io/v2/login/ui/consent?state=test' };
 render(<VehiclePage />);
 expect(screen.queryByLabelText('Code reçu par e-mail')).toBeNull();
 expect(screen.getByRole('link', { name: 'Ouvrir l’autorisation Volkswagen ↗' }).getAttribute('href')).toContain('https://identity.vwgroup.io/v2/login/ui/consent');
 expect(screen.getByRole('link', { name: 'Ouvrir mon compte Volkswagen en français ↗' }).getAttribute('href')).toBe('https://www.volkswagen.fr/fr/entretenir-ma-volkswagen/myvolkswagen.html');
});

const vehicle = (changes: Partial<VehicleData> = {}): VehicleData => ({ vin: 'test', battery: 73, range: 284, target: null, batteryTemperature: null, chargingState: 'charging', power: 7.2, chargeRate: null, remainingMinutes: 42, chargeType: null, plug: 'connected', plugLock: null, externalPower: null, odometer: null, inspectionDays: null, inspectionKm: null, reportedAt: new Date().toISOString(), chargingReportedAt: new Date().toISOString(), plugReportedAt: null, odometerReportedAt: null, fetchedAt: Date.now(), ...changes });
const connect = (data: VehicleData) => { mock.session = { ...disconnected, phase: 'connected', data }; };
it('animates charging only when Volkswagen reports a recent charging state', async () => {
 connect(vehicle());
 const { container } = render(<VehiclePage />);
 expect(container.querySelector('.vehicle-showcase')?.getAttribute('data-charging')).toBe('true');
 expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('73');
 expect(screen.getByText('284')).toBeTruthy(); expect(screen.getByText('Encore 42 min')).toBeTruthy();
 expect(await screen.findByTestId('vehicle-scene')).toBeTruthy();
});
it('does not animate an old report, an unknown timestamp, or power alone', () => {
 for (const changes of [{ chargingReportedAt: '2020-01-01T00:00:00Z' }, { chargingReportedAt: null, reportedAt: null }, { chargingState: 'off', power: 7.2 }]) {
  connect(vehicle(changes)); const { container, unmount } = render(<VehiclePage />);
  expect(container.querySelector('.vehicle-showcase')?.getAttribute('data-charging')).toBe('false'); unmount();
 }
});
it('keeps zero battery visible and the full charging details behind navigation', () => {
 connect(vehicle({ battery: 0, range: 0, chargingState: 'off' }));
 render(<VehiclePage />);
 expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
 fireEvent.click(screen.getByRole('button', { name: 'Recharge' }));
 expect(screen.getByText('Puissance')).toBeTruthy(); expect(screen.getByText('7,2 kW')).toBeTruthy();
});
