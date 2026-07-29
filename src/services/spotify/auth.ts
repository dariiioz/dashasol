export interface SpotifyTokens { accessToken: string; refreshToken?: string; expiresAt: number }
export const spotifyScopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-read-private', 'playlist-read-collaborative'] as const;
const AUTHORIZE = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const VERIFIER_KEY = 'sillage-spotify-verifier'; const STATE_KEY = 'sillage-spotify-state';
/** The environment variable is the fallback: a Client ID baked at build time works even on a freshly wiped device. */
export const configuredClientId = (stored?: string) => (stored ?? '').trim() || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
/** Spotify refuses every plain HTTP redirect except the loopback address, so the callback must be reached on 127.0.0.1. */
export const redirectUri = (origin = window.location.origin) => `${origin}/callback`;
export const loopbackReady = (origin = window.location.origin) => origin.startsWith('https://') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://[::1]');
const base64url = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const randomString = () => base64url(globalThis.crypto.getRandomValues(new Uint8Array(48)).buffer);
export const codeChallenge = async (verifier: string) => base64url(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
/** Authorization Code with PKCE: no client secret exists anywhere in this application. */
export async function startAuthorization(clientId: string) {
  const verifier = randomString(); const state = randomString();
  sessionStorage.setItem(VERIFIER_KEY, verifier); sessionStorage.setItem(STATE_KEY, state);
  const query = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri(), scope: spotifyScopes.join(' '), code_challenge_method: 'S256', code_challenge: await codeChallenge(verifier), state });
  window.location.assign(`${AUTHORIZE}?${query}`);
}
export const pendingAuthorization = () => { const params = new URLSearchParams(window.location.search); return { code: params.get('code'), state: params.get('state'), error: params.get('error') }; };
async function exchange(body: Record<string, string>): Promise<SpotifyTokens> {
  const response = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? payload.error ?? 'Spotify a refusé la connexion.');
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
}
export async function completeAuthorization(clientId: string, code: string, state: string | null) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY); const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY); sessionStorage.removeItem(STATE_KEY);
  if (!verifier) throw new Error('La demande de connexion a expiré. Relancez-la depuis les Réglages.');
  if (expected && state !== expected) throw new Error('Réponse de connexion inattendue : demande abandonnée.');
  return exchange({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier });
}
/** Spotify rotates the refresh token on most refreshes: the caller must persist whatever comes back. */
export const refreshTokens = (clientId: string, refreshToken: string) => exchange({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
