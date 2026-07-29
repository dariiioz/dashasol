import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { completeAuthorization, configuredClientId, pendingAuthorization, refreshTokens, startAuthorization, type SpotifyTokens } from '../services/spotify/auth';
import { SpotifyClient, SpotifyError, toNowPlaying, toPlaylists, type SpotifyDevice, type SpotifyNow, type SpotifyPlaylist } from '../services/spotify/client';

let session: SpotifyTokens | undefined;
/** One access token per tab, refreshed a minute before it expires. The rotating refresh token goes back to the store. */
async function accessToken() {
  const { spotify, setSpotify } = useAppStore.getState(); const clientId = configuredClientId(spotify.clientId);
  if (session && session.expiresAt - 60_000 > Date.now()) return session.accessToken;
  if (!clientId || !spotify.refreshToken) throw new SpotifyError(401, 'Spotify n’est pas connecté.');
  const tokens = await refreshTokens(clientId, spotify.refreshToken);
  session = tokens; if (tokens.refreshToken) setSpotify({ refreshToken: tokens.refreshToken });
  return tokens.accessToken;
}
export const spotifyClient = new SpotifyClient(accessToken);
export const forgetSpotifySession = () => { session = undefined; };
/** Handles the return from the Spotify consent screen, then puts the address bar back where it was. */
export function useSpotifyCallback() {
  const setSpotify = useAppStore(s => s.setSpotify); const notify = useAppStore(s => s.notify); const done = useRef(false);
  useEffect(() => {
    if (done.current || !window.location.pathname.startsWith('/callback')) return; done.current = true;
    const { code, state, error } = pendingAuthorization();
    const clean = () => window.history.replaceState({}, '', '/');
    if (error) { notify({ kind: 'error', text: 'Connexion Spotify refusée.' }); clean(); return; }
    if (!code) { clean(); return; }
    const clientId = configuredClientId(useAppStore.getState().spotify.clientId);
    if (!clientId) { notify({ kind: 'error', text: 'Aucun identifiant d’application Spotify enregistré.' }); clean(); return; }
    void completeAuthorization(clientId, code, state).then(tokens => { session = tokens; setSpotify({ refreshToken: tokens.refreshToken }); notify({ kind: 'success', text: 'Spotify est connecté.' }); }).catch((failure: Error) => notify({ kind: 'error', text: failure.message })).finally(clean);
  }, [notify, setSpotify]);
}
type Status = 'disconnected' | 'loading' | 'ready' | 'idle' | 'error';
/** Polls the player only while the music page is on screen: Spotify rate-limits, and a wall display must not hammer it. */
export function useSpotifyPlayer(active: boolean) {
  const spotify = useAppStore(s => s.spotify); const connected = Boolean(configuredClientId(spotify.clientId) && spotify.refreshToken);
  const [now, setNow] = useState<SpotifyNow>(); const [devices, setDevices] = useState<SpotifyDevice[]>([]); const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]); const [status, setStatus] = useState<Status>(connected ? 'loading' : 'disconnected'); const [detail, setDetail] = useState<string>();
  const timer = useRef<number>(undefined); const pending = useRef(false);
  const read = useCallback(async () => {
    if (pending.current) return; pending.current = true;
    try { const playback = await spotifyClient.playback(); const current = toNowPlaying(playback); setNow(current); setStatus(current ? 'ready' : 'idle'); setDetail(undefined); }
    catch (failure) { const error = failure as SpotifyError; setStatus(error.status === 404 ? 'idle' : 'error'); setDetail(error.message); }
    finally { pending.current = false; }
  }, []);
  useEffect(() => { if (!connected || !active) return; void read(); const tick = () => { timer.current = window.setTimeout(async () => { await read(); tick(); }, 5000); }; tick(); return () => window.clearTimeout(timer.current); }, [active, connected, read]);
  useEffect(() => { if (!connected || !active) return; void spotifyClient.devices().then(payload => setDevices(payload?.devices ?? [])).catch(() => setDevices([])); }, [active, connected, now?.device]);
  const command = useCallback(async (action: (client: SpotifyClient) => Promise<unknown>) => {
    try { await action(spotifyClient); setDetail(undefined); }
    catch (failure) { const error = failure as SpotifyError; setDetail(error.message); setStatus(error.status === 404 ? 'idle' : 'error'); return false; }
    window.setTimeout(() => void read(), 350); return true;
  }, [read]);
  /** Playlists barely change: read once per visit rather than on every poll. */
  useEffect(() => { if (!connected || !active) return; void spotifyClient.playlists().then(payload => setPlaylists(toPlaylists(payload?.items))).catch((failure: SpotifyError) => { setPlaylists([]); if (failure.status === 403) setDetail('Reconnectez Spotify dans les Réglages pour autoriser l’accès à vos playlists.'); }); }, [active, connected]);
  /** Nothing playing means no active device: aim the first one Spotify knows rather than failing. */
  const target = useCallback(() => (devices.find(item => item.is_active) ?? devices[0])?.id ?? undefined, [devices]);
  const start = useCallback((contextUri: string) => command(client => client.playContext(contextUri, target())), [command, target]);
  const startTracks = useCallback((uris: string[]) => command(client => client.playTracks(uris, target())), [command, target]);
  const connect = useCallback(() => { const clientId = configuredClientId(useAppStore.getState().spotify.clientId); if (clientId) void startAuthorization(clientId); }, []);
  return useMemo(() => ({ now, devices, playlists, status: connected ? status : 'disconnected' as Status, detail, connected, command, start, startTracks, refresh: read, connect }), [command, connected, detail, devices, now, playlists, read, start, startTracks, status, connect]);
}
