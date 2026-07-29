import { describe, expect, it } from 'vitest';
import { codeChallenge, loopbackReady, redirectUri, spotifyScopes } from './auth';
describe('spotify authorization', () => {
  it('only accepts an origin Spotify will redirect back to', () => {
    expect(loopbackReady('http://127.0.0.1:5173')).toBe(true);
    expect(loopbackReady('https://sillage.maison')).toBe(true);
    expect(loopbackReady('http://localhost:5173')).toBe(false);
    expect(loopbackReady('http://192.168.1.50:4173')).toBe(false);
  });
  it('builds the callback address declared in the Spotify dashboard', () => expect(redirectUri('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173/callback'));
  it('derives a URL-safe S256 challenge from the verifier', async () => {
    /** Reference pair from RFC 7636, appendix B. */
    const challenge = await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(challenge).not.toMatch(/[+/=]/);
  });
  it('asks for playback control and the playlists it offers', () => expect([...spotifyScopes]).toEqual(['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-read-private', 'playlist-read-collaborative']));
});
