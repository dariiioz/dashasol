import { describe, expect, it } from 'vitest';
import { clock, elapsed, toNowPlaying, toPlaylists, type SpotifyPlayback } from './client';
const playback: SpotifyPlayback = { device: { id: '1', name: 'Freebox Player Pop', type: 'Speaker', is_active: true, volume_percent: 42 }, is_playing: true, progress_ms: 61_000, shuffle_state: true, repeat_state: 'context', item: { name: 'Nightcall', duration_ms: 254_000, artists: [{ name: 'Kavinsky' }, { name: 'Lovefoxxx' }], album: { name: 'OutRun', images: [{ url: 'small.jpg', width: 64 }, { url: 'big.jpg', width: 640 }] } } };
describe('spotify playback', () => {
  it('flattens a playback payload and keeps the largest artwork', () => {
    const now = toNowPlaying(playback, 1000)!;
    expect(now).toMatchObject({ title: 'Nightcall', artist: 'Kavinsky, Lovefoxxx', album: 'OutRun', artwork: 'big.jpg', durationMs: 254_000, playing: true, shuffle: true, repeat: 'context', device: 'Freebox Player Pop', volume: 42 });
  });
  it('returns nothing when no track is loaded', () => { expect(toNowPlaying({ is_playing: false, progress_ms: null, item: null })).toBeUndefined(); expect(toNowPlaying(undefined)).toBeUndefined(); });
  it('advances the position between two polls, and only while playing', () => {
    const now = toNowPlaying(playback, 10_000)!;
    expect(elapsed(now, 13_000)).toBe(64_000);
    expect(elapsed({ ...now, playing: false }, 13_000)).toBe(61_000);
  });
  it('never runs past the end of the track', () => expect(elapsed(toNowPlaying(playback, 0)!, 10 * 60_000)).toBe(254_000));
  it('keeps only playlists that can be drawn and played', () => {
    const playlists = toPlaylists([{ id: '1', uri: 'spotify:playlist:1', name: 'Cuisine', images: [{ url: 'small.jpg', width: 60 }, { url: 'large.jpg', width: 640 }], tracks: { total: 42 }, owner: { display_name: 'Aymeric' } }, { id: '2', uri: 'spotify:playlist:2', name: 'Sans pochette', images: null }, { id: '3', uri: '', name: 'Cassée', images: [] }] as never);
    expect(playlists).toHaveLength(2);
    expect(playlists[0]).toMatchObject({ uri: 'spotify:playlist:1', name: 'Cuisine', cover: 'large.jpg', tracks: 42, owner: 'Aymeric' });
    expect(playlists[1]).toMatchObject({ name: 'Sans pochette', cover: undefined, tracks: 0 });
  });
  it('remembers which context is playing so the shelf can mark it', () => expect(toNowPlaying({ ...playback, context: { uri: 'spotify:playlist:1' } })?.contextUri).toBe('spotify:playlist:1'));
  it('formats a duration for humans', () => { expect(clock(61_000)).toBe('1:01'); expect(clock(254_000)).toBe('4:14'); expect(clock(-5)).toBe('0:00'); });
});
