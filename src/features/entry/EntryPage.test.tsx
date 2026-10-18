// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { initialEufy } from '../../services/eufy/client';
import { EntryPage } from './EntryPage';
const mock = vi.hoisted(() => ({ status: {} as unknown, run: vi.fn() }));
vi.mock('../../hooks/useEufy', () => ({ useEufy: () => ({ status: mock.status, run: mock.run, busy: false }) }));
beforeEach(() => { useAppStore.setState({ demo: false }); mock.status = initialEufy; mock.run.mockResolvedValue(false); }); afterEach(cleanup);
it('clears the password as soon as it is submitted and does not save it in localStorage', () => {
  render(<EntryPage />); fireEvent.change(screen.getByLabelText('E-mail Eufy'), { target: { value: 'test@example.org' } });
  const password = screen.getByLabelText('Mot de passe Eufy') as HTMLInputElement; fireEvent.change(password, { target: { value: 'private-eufy-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Connecter Eufy' }).closest('form')!);
  expect(password.value).toBe(''); expect(mock.run).toHaveBeenCalledWith('login', { email: 'test@example.org', password: 'private-eufy-password' }); expect(JSON.stringify(localStorage)).not.toContain('private-eufy-password');
});
it('asks the user for the Eufy verification code instead of showing the password again', () => {
  mock.status = { ...initialEufy, phase: '2fa' }; render(<EntryPage />);
  expect(screen.queryByLabelText('Mot de passe Eufy')).toBeNull();
  fireEvent.change(screen.getByLabelText('Code Eufy'), { target: { value: '123456' } }); fireEvent.submit(screen.getByRole('button', { name: 'Valider' }).closest('form')!);
  expect(mock.run).toHaveBeenCalledWith('verify', { code: '123456' }); expect((screen.getByLabelText('Code Eufy') as HTMLInputElement).value).toBe('');
});
