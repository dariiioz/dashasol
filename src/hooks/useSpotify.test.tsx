// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { spotifyClient, useSpotifyPlayer } from './useSpotify';
import { useAppStore } from '../stores/appStore';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('only polls playback for the home card and stops when the browser is hidden', async () => {
  vi.useFakeTimers();
  useAppStore.setState({ spotify: { clientId: 'test-client', refreshToken: 'test-token' } });
  const playback = vi.spyOn(spotifyClient, 'playback').mockResolvedValue(undefined);
  const devices = vi.spyOn(spotifyClient, 'devices').mockResolvedValue({ devices: [] });
  const playlists = vi.spyOn(spotifyClient, 'playlists').mockResolvedValue({ items: [] });
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { unmount } = renderHook(() => useSpotifyPlayer(true, { library: false, pollInterval: 10000 }));
  await act(async () => {});
  expect(playback).toHaveBeenCalledTimes(1); expect(devices).not.toHaveBeenCalled(); expect(playlists).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(playback).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue('hidden'); act(() => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(playback).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue('visible'); await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(playback).toHaveBeenCalledTimes(3);
  unmount(); await vi.advanceTimersByTimeAsync(30000);
  expect(playback).toHaveBeenCalledTimes(3);
});
