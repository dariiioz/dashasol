import { lazy, Suspense, useRef, useState } from 'react';
import { ChevronRight, ListMusic, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useSpotifyPlayer } from '../../hooks/useSpotify';
import type { SpotifyClient } from '../../services/spotify/client';
import { QuickDrawer } from '../../components/QuickDrawer';

const SpotifySettings = lazy(() => import('../settings/SettingsPage').then(module => ({ default: module.SpotifySettings })));

export function HomeSpotifyCard() {
  const demo = useAppStore(s => s.demo);
  const setPage = useAppStore(s => s.setPage);
  const player = useSpotifyPlayer(!demo, { library: false, pollInterval: 10_000 });
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const connected = player.connected && !demo;
  const now = connected ? player.now : undefined;
  const run = async (action: (client: SpotifyClient) => Promise<unknown>) => {
    if (lock.current || !connected || !now) return;
    lock.current = true; setBusy(true);
    try { await player.command(action); } finally { lock.current = false; setBusy(false); }
  };
  return <article className="home-spotify" aria-label="Lecteur Spotify" aria-busy={busy}>
    <button className="home-spotify-track" aria-label={connected ? 'Ouvrir Spotify' : 'Configurer Spotify'} onClick={() => connected ? setPage('media') : setSettings(true)}>
      <span className="home-spotify-art">{now?.artwork ? <img src={now.artwork} alt="" /> : <Music2 size={24} />}</span>
      <span className="home-spotify-info"><small>Spotify{now?.device ? ` · ${now.device}` : ''}</small><b>{now?.title ?? (connected ? player.status === 'loading' ? 'Connexion…' : 'Aucune lecture en cours' : 'Votre musique')}</b><span>{now?.artist ?? (connected ? 'Choisir une musique' : 'Connecter votre compte')}</span></span><ChevronRight size={16} />
    </button>
    {connected ? <div className="home-spotify-controls"><button aria-label="Morceau précédent" disabled={busy || !now || player.status === 'error'} onClick={() => void run(client => client.previous())}><SkipBack size={19} /></button><button className="home-spotify-play" aria-label={now?.playing ? 'Mettre Spotify en pause' : 'Lire Spotify'} disabled={busy || !now || player.status === 'error'} onClick={() => void run(client => now?.playing ? client.pause() : client.play())}>{now?.playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button aria-label="Morceau suivant" disabled={busy || !now || player.status === 'error'} onClick={() => void run(client => client.next())}><SkipForward size={19} /></button><button aria-label="Ouvrir les playlists Spotify" onClick={() => setPage('media')}><ListMusic size={19} /></button></div> : <button className="home-spotify-connect" onClick={() => setSettings(true)}>Connecter Spotify <ChevronRight size={16} /></button>}
    {connected && player.detail && <p className="home-spotify-error" role="status">{player.detail}</p>}
    {settings && <QuickDrawer title="Connexion Spotify" onClose={() => setSettings(false)}><div className="spotify-quick-settings"><Suspense fallback={<p className="muted">Chargement…</p>}><SpotifySettings /></Suspense></div></QuickDrawer>}
  </article>;
}
