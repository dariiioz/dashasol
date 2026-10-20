// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SpotifyNow } from '../../services/spotify/client';
import { useAppStore } from '../../stores/appStore';
import { HomeSpotifyCard } from './HomeSpotifyCard';
const mock = vi.hoisted(() => ({ now: undefined as SpotifyNow | undefined, command: vi.fn(), pause: vi.fn(), play: vi.fn(), next: vi.fn(), previous: vi.fn() }));
vi.mock('../../hooks/useSpotify', () => ({ useSpotifyPlayer: () => ({ connected: true, status: 'ready', now: mock.now, command: mock.command }) }));
beforeEach(() => {
  useAppStore.setState({ demo: false }); vi.clearAllMocks();
  mock.now = { title: 'La chanson', artist: 'Artiste', album: 'Album', playing: true, shuffle: false, repeat: 'off', durationMs: 180000, progressMs: 30000, readAt: Date.now() };
  mock.command.mockImplementation(async action => { await action(mock); return true; });
});
afterEach(cleanup);
it('shows the current song and sends pause and skip commands', async () => {
  render(<HomeSpotifyCard />);
  expect(screen.getByText('La chanson')).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mettre Spotify en pause' })));
  expect(mock.pause).toHaveBeenCalledTimes(1);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Morceau suivant' })));
  expect(mock.next).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les playlists Spotify' }));
  expect(useAppStore.getState().activePage).toBe('media');
});
it('does not expose playback controls when no track is available', () => {
  mock.now = undefined; render(<HomeSpotifyCard />);
  expect((screen.getByRole('button', { name: 'Lire Spotify' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Aucune lecture en cours')).toBeTruthy();
});
it('does not send a second command while the first one is pending', async () => {
  let resolve!: (value: boolean) => void;
  mock.command.mockImplementation(() => new Promise<boolean>(done => { resolve = done; }));
  render(<HomeSpotifyCard />);
  const pause = screen.getByRole('button', { name: 'Mettre Spotify en pause' });
  fireEvent.click(pause); fireEvent.click(pause);
  expect(mock.command).toHaveBeenCalledTimes(1);
  await act(async () => resolve(true));
});
