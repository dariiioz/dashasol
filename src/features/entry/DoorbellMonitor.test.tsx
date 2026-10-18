// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DoorbellMonitor } from './DoorbellMonitor';
import { useDoorbellStore } from '../../stores/doorbellStore';
import { useAppStore } from '../../stores/appStore';
import { initialEufy, type EufyStatus } from '../../services/eufy/client';
const mock = vi.hoisted(() => ({ status: {} as EufyStatus, mounts: 0 }));
vi.mock('../../hooks/useEufy', () => ({ useEufy: () => ({ status: mock.status }) }));
vi.mock('./EufyLiveVideo', () => ({ EufyLiveVideo: ({ close }: { close: () => void }) => <button onClick={close}>Arrêter le direct</button> }));
const now = Date.parse('2026-10-18T16:00:00Z');
const ring = (id = 'new', kind = 'doorbellPress', receivedAt = now + 1) => ({ id, kind, receivedAt, deviceSn: 'door' }) as EufyStatus['events'][number];
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  useAppStore.setState({ demo: false, activePage: 'energy' }); useDoorbellStore.setState({ open: false, ringing: false });
  mock.status = { ...initialEufy, phase: 'connected', selected: 'door', devices: [{ sn: 'door', name: 'Entrée', model: 'T8210C', homebase: 'T8010', battery: 100, capabilities: [], liveAvailable: true, storedImage: true }], events: [] };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('opens above the dashboard on a fresh ring even outside the home page', () => {
  const { rerender, container } = render(<DoorbellMonitor />);
  mock.status = { ...mock.status, events: [ring()] }; rerender(<DoorbellMonitor />);
  const dialog = screen.getByRole('dialog', { name: 'Sonnette en direct' });
  expect(container.contains(dialog)).toBe(false);
  expect(screen.getByText('Quelqu’un a sonné')).toBeTruthy();
  expect(useAppStore.getState().activePage).toBe('energy');
});
it('does not replay old activity on startup or open the video on motion', () => {
  mock.status = { ...mock.status, events: [ring('old', 'doorbellPress', now - 1000), ring('motion', 'motion')] };
  render(<DoorbellMonitor />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('does not reopen the same ring after closing it or after navigating', () => {
  const { rerender } = render(<DoorbellMonitor />);
  mock.status = { ...mock.status, events: [ring()] }; rerender(<DoorbellMonitor />);
  fireEvent.click(screen.getByRole('button', { name: 'Arrêter le direct' }));
  useAppStore.setState({ activePage: 'vehicle' });
  mock.status = { ...mock.status }; rerender(<DoorbellMonitor />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('keeps a single player when a ring arrives during manual viewing', () => {
  useDoorbellStore.getState().openLive();
  const { rerender } = render(<DoorbellMonitor />);
  mock.status = { ...mock.status, events: [ring()] }; rerender(<DoorbellMonitor />);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Arrêter le direct' })).toHaveLength(1);
});
it('ignores unrelated devices and closes when the Eufy session disconnects', () => {
  const { rerender } = render(<DoorbellMonitor />);
  mock.status = { ...mock.status, events: [{ ...ring(), deviceSn: 'other' }] }; rerender(<DoorbellMonitor />);
  expect(screen.queryByRole('dialog')).toBeNull();
  mock.status = { ...mock.status, events: [ring('valid')] }; rerender(<DoorbellMonitor />);
  expect(screen.getByRole('dialog')).toBeTruthy();
  mock.status = initialEufy; rerender(<DoorbellMonitor />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
