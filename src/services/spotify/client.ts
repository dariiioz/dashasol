export interface SpotifyDevice { id: string | null; name: string; type: string; is_active: boolean; volume_percent: number | null }
export interface SpotifyPlayback { device?: SpotifyDevice; is_playing: boolean; progress_ms: number | null; shuffle_state?: boolean; repeat_state?: 'off' | 'track' | 'context'; context?: { uri: string } | null; item?: { name: string; duration_ms: number; artists: { name: string }[]; album: { name: string; images: { url: string; width: number }[] } } | null }
export interface SpotifyNow { title: string; artist: string; album: string; artwork?: string; contextUri?: string; durationMs: number; progressMs: number; playing: boolean; shuffle: boolean; repeat: 'off' | 'track' | 'context'; device?: string; volume?: number; readAt: number }
export interface SpotifyPlaylistItem { id: string; uri: string; name: string; images: { url: string; width: number | null }[] | null; tracks?: { total: number }; owner?: { display_name?: string } }
export interface SpotifyPlaylist { id: string; uri: string; name: string; cover?: string; tracks: number; owner?: string }
export interface SpotifyTrackItem { id: string; uri: string; name: string; artists: { name: string }[]; album?: { name: string; images: { url: string; width: number | null }[] | null } }
export interface SpotifyTrack { id: string; uri: string; name: string; artist: string; cover?: string }
export interface SpotifySearch { tracks: SpotifyTrack[]; playlists: SpotifyPlaylist[] }
export class SpotifyError extends Error { constructor(readonly status: number, message: string, readonly retryAfter?: number) { super(message); } }
const message = (status: number, detail?: string) => status === 401 ? 'Session Spotify expirée.' : status === 403 ? detail ?? 'Spotify a refusé cette commande (compte non Premium ou lecture restreinte).' : status === 404 ? 'Aucun appareil Spotify actif : lancez la lecture sur une enceinte, la Freebox ou votre téléphone.' : status === 429 ? 'Trop de requêtes Spotify : pause de quelques secondes.' : detail ?? 'Spotify est injoignable.';
/** Thin wrapper over the Spotify Web API. The token provider refreshes on demand; nothing is cached here. */
export class SpotifyClient {
  constructor(private token: () => Promise<string>) {}
  private async call<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    const response = await fetch(`https://api.spotify.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', ...init?.headers } });
    if (response.status === 204 || response.status === 202) return undefined;
    const payload = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
    if (!response.ok) throw new SpotifyError(response.status, message(response.status, payload?.error?.message), Number(response.headers.get('Retry-After')) || undefined);
    return payload as T;
  }
  playback() { return this.call<SpotifyPlayback>('/me/player'); }
  devices() { return this.call<{ devices: SpotifyDevice[] }>('/me/player/devices'); }
  playlists(limit = 50) { return this.call<{ items: SpotifyPlaylistItem[] }>(`/me/playlists?limit=${limit}`); }
  /** Starting a context on a named device avoids the "no active device" dead end when nothing is playing yet. */
  playContext(contextUri: string, deviceId?: string) { return this.call(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'PUT', body: JSON.stringify({ context_uri: contextUri }) }); }
  playTracks(uris: string[], deviceId?: string) { return this.call(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'PUT', body: JSON.stringify({ uris }) }); }
  /** No `limit` here: Spotify rejects the parameter outright for third-party apps and serves five results per type. */
  search(query: string) { return this.call<{ tracks?: { items: (SpotifyTrackItem | null)[] }; playlists?: { items: (SpotifyPlaylistItem | null)[] } }>(`/search?q=${encodeURIComponent(query)}&type=track,playlist`); }
  play() { return this.call('/me/player/play', { method: 'PUT' }); }
  pause() { return this.call('/me/player/pause', { method: 'PUT' }); }
  next() { return this.call('/me/player/next', { method: 'POST' }); }
  previous() { return this.call('/me/player/previous', { method: 'POST' }); }
  seek(positionMs: number) { return this.call(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, { method: 'PUT' }); }
  volume(percent: number) { return this.call(`/me/player/volume?volume_percent=${Math.min(100, Math.max(0, Math.round(percent)))}`, { method: 'PUT' }); }
  shuffle(state: boolean) { return this.call(`/me/player/shuffle?state=${state}`, { method: 'PUT' }); }
  repeat(state: 'off' | 'track' | 'context') { return this.call(`/me/player/repeat?state=${state}`, { method: 'PUT' }); }
  transfer(deviceId: string, play = true) { return this.call('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play }) }); }
}
/** Flattens the payload into exactly what the interface draws, and remembers when it was read to keep the progress bar honest. */
export const toNowPlaying = (playback: SpotifyPlayback | undefined, readAt = Date.now()): SpotifyNow | undefined => playback?.item ? ({
  title: playback.item.name, artist: playback.item.artists.map(artist => artist.name).join(', '), album: playback.item.album.name,
  artwork: [...(playback.item.album.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url,
  contextUri: playback.context?.uri, durationMs: playback.item.duration_ms, progressMs: playback.progress_ms ?? 0, playing: playback.is_playing,
  shuffle: Boolean(playback.shuffle_state), repeat: playback.repeat_state ?? 'off', device: playback.device?.name, volume: playback.device?.volume_percent ?? undefined, readAt
}) : undefined;
/** Spotify sometimes returns null entries and coverless playlists: keep only what can actually be drawn and played. */
export const toPlaylists = (items: SpotifyPlaylistItem[] | undefined): SpotifyPlaylist[] => (items ?? []).filter(item => item?.uri && item.name).map(item => ({ id: item.id, uri: item.uri, name: item.name, cover: [...(item.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url, tracks: item.tracks?.total ?? 0, owner: item.owner?.display_name }));
const largest = (images: { url: string; width: number | null }[] | null | undefined) => [...(images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
/** Search answers contain null holes since Spotify stopped exposing its own editorial content: drop them rather than draw ghosts. */
export const toSearchResults = (payload: { tracks?: { items: (SpotifyTrackItem | null)[] }; playlists?: { items: (SpotifyPlaylistItem | null)[] } } | undefined): SpotifySearch => ({
  tracks: (payload?.tracks?.items ?? []).filter((item): item is SpotifyTrackItem => Boolean(item?.uri && item.name)).map(item => ({ id: item.id, uri: item.uri, name: item.name, artist: item.artists?.map(artist => artist.name).join(', ') ?? '', cover: largest(item.album?.images) })),
  playlists: toPlaylists((payload?.playlists?.items ?? []).filter((item): item is SpotifyPlaylistItem => Boolean(item)))
});
export const elapsed = (now: SpotifyNow, at = Date.now()) => Math.min(now.durationMs, now.progressMs + (now.playing ? Math.max(0, at - now.readAt) : 0));
export const clock = (milliseconds: number) => { const total = Math.max(0, Math.round(milliseconds / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };
