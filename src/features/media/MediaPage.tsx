import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Laptop2, LoaderCircle, Music4, Pause, Pin, PinOff, Play, Repeat, Repeat1, Search, Shuffle, SkipBack, SkipForward, Smartphone, Speaker, Volume2, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { callHomeAssistantService } from '../../hooks/useHomeAssistant';
import { useEntityName } from '../../hooks/useEntityName';
import { spotifyClient, useSpotifyPlayer } from '../../hooks/useSpotify';
import { configuredClientId } from '../../services/spotify/auth';
import { clock, elapsed, toSearchResults, type SpotifyDevice, type SpotifyError, type SpotifyPlaylist, type SpotifySearch } from '../../services/spotify/client';
import { unavailable } from '../../utils/entities';
import { selectedIds } from '../../utils/dashboard';
import type { HassEntity } from '../../types/homeAssistant';
const deviceIcon = (type: string) => type === 'Smartphone' ? Smartphone : type === 'Computer' ? Laptop2 : Speaker;
export function MediaPage() {
  const haIds = selectedIds(useAppStore(s => s.dashboard.mediaEntities)); const entities = useAppStore(s => s.entities); const name = useEntityName();
  const player = useSpotifyPlayer(true); const [source, setSource] = useState<string>();
  const current = source ?? (player.connected ? 'spotify' : haIds[0]);
  const sources = [...(player.connected ? [{ id: 'spotify', label: 'Spotify' }] : []), ...haIds.map(id => ({ id, label: name(entities[id] ?? id) }))];
  const entity = current && current !== 'spotify' ? entities[current] : undefined;
  return <section className="page media-page"><header className="page-heading"><div><p className="eyebrow">{current === 'spotify' ? player.now?.device ? `Spotify · ${player.now.device}` : 'Spotify' : entity ? `Lecture dans ${name(entity)}` : 'Son & présence'}</p><h1>La maison, <em>en musique.</em></h1></div>{sources.length > 1 && <div className="global-actions">{sources.map(item => <button key={item.id} className={item.id === current ? 'selected' : ''} aria-pressed={item.id === current} onClick={() => setSource(item.id)}>{item.label}</button>)}</div>}</header>
    {current === 'spotify' ? <><SpotifyPlayer player={player} /><SpotifyBrowser player={player} /></> : entity ? <HomeAssistantPlayer entity={entity} /> : <SpotifyInvitation player={player} />}
  </section>;
}
function SpotifyInvitation({ player }: { player: ReturnType<typeof useSpotifyPlayer> }) {
  const clientId = configuredClientId(useAppStore(s => s.spotify.clientId)); const setPage = useAppStore(s => s.setPage);
  return <article className="media-invitation"><Music4 size={30} /><h2>Écoutez ce que vous voulez</h2><p>{clientId ? 'Connectez votre compte Spotify pour piloter la musique de la maison depuis ce mur.' : 'Aucun lecteur n’est configuré. Ajoutez un lecteur Home Assistant ou l’identifiant de votre application Spotify dans les Réglages.'}</p><div className="global-actions">{clientId && <button className="selected" onClick={player.connect}>Connecter Spotify</button>}<button onClick={() => setPage('settings')}>Ouvrir les Réglages</button></div></article>;
}
function SpotifyPlayer({ player }: { player: ReturnType<typeof useSpotifyPlayer> }) {
  const { now, devices, status, detail, command } = player;
  /** A local half-second tick keeps the progress bar moving between two polls, without asking Spotify anything. */
  const [, setTick] = useState(0); const [seek, setSeek] = useState<number>(); const [volume, setVolume] = useState<number>();
  useEffect(() => { if (!now?.playing) return; const id = window.setInterval(() => setTick(value => value + 1), 500); return () => window.clearInterval(id); }, [now?.playing]);
  useEffect(() => setVolume(undefined), [now?.volume]);
  if (status === 'disconnected') return <SpotifyInvitation player={player} />;
  if (!now) return <article className="media-invitation"><Music4 size={30} /><h2>{status === 'loading' ? 'Connexion à Spotify…' : 'Rien ne joue pour le moment'}</h2><p>{detail ?? 'Lancez une lecture depuis un appareil Spotify : elle apparaîtra ici et vous pourrez la piloter.'}</p>{devices.length > 0 && <DeviceList devices={devices} command={command} />}</article>;
  const position = seek ?? elapsed(now);
  const level = volume ?? now.volume ?? 0;
  return <article className="now-playing"><div className="album-art" style={now.artwork ? { backgroundImage: `url(${now.artwork})` } : undefined}>{!now.artwork && <span>♪</span>}</div><div className="track"><p>{now.album}</p><h2>{now.title}</h2><span>{now.artist}</span>
    <label className="seek"><input aria-label="Position dans le morceau" type="range" min="0" max={now.durationMs} step="1000" value={position} onChange={event => setSeek(Number(event.target.value))} onPointerUp={() => { if (seek !== undefined) { void command(client => client.seek(seek)); setSeek(undefined); } }} onKeyUp={() => { if (seek !== undefined) { void command(client => client.seek(seek)); setSeek(undefined); } }} /><small>{clock(position)}</small><small>−{clock(Math.max(0, now.durationMs - position))}</small></label>
    <div className="media-controls"><button aria-label="Lecture aléatoire" aria-pressed={now.shuffle} className={now.shuffle ? 'toggled' : ''} onClick={() => void command(client => client.shuffle(!now.shuffle))}><Shuffle size={18} /></button><button aria-label="Précédent" onClick={() => void command(client => client.previous())}><SkipBack /></button><button className="play-button" aria-label={now.playing ? 'Pause' : 'Lecture'} onClick={() => void command(client => now.playing ? client.pause() : client.play())}>{now.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button aria-label="Suivant" onClick={() => void command(client => client.next())}><SkipForward /></button><button aria-label="Répéter" aria-pressed={now.repeat !== 'off'} className={now.repeat !== 'off' ? 'toggled' : ''} onClick={() => void command(client => client.repeat(now.repeat === 'off' ? 'context' : now.repeat === 'context' ? 'track' : 'off'))}>{now.repeat === 'track' ? <Repeat1 size={19} /> : <Repeat size={19} />}</button></div>
    {now.volume !== undefined && <label className="volume"><Volume2 size={18} /><input aria-label="Volume" type="range" min="0" max="100" value={level} onChange={event => setVolume(Number(event.target.value))} onPointerUp={() => volume !== undefined && void command(client => client.volume(volume))} onKeyUp={() => volume !== undefined && void command(client => client.volume(volume))} /><small>{level}%</small></label>}
    <DeviceList devices={devices} command={command} />
    {detail && <p className="media-detail">{detail}</p>}
  </div></article>;
}
/** Search and playlists share one shelf: from a silent house, two taps must be enough to fill it with music. */
function SpotifyBrowser({ player }: { player: ReturnType<typeof useSpotifyPlayer> }) {
  const { playlists, start, startTracks, now } = player;
  /** The selector must return the stored reference: defaulting to `[]` inside it would build a new array on every render. */
  const stored = useAppStore(s => s.spotify.pinned); const pinned = useMemo(() => stored ?? [], [stored]); const setSpotify = useAppStore(s => s.setSpotify);
  const [query, setQuery] = useState(''); const [results, setResults] = useState<SpotifySearch>(); const [searching, setSearching] = useState(false); const [failure, setFailure] = useState<string>();
  useEffect(() => {
    const term = query.trim(); if (term.length < 2) { setResults(undefined); setFailure(undefined); setSearching(false); return; }
    let cancelled = false; setSearching(true); const id = window.setTimeout(() => { void spotifyClient.search(term).then(payload => { if (cancelled) return; setResults(toSearchResults(payload)); setFailure(undefined); }).catch((error: SpotifyError) => { if (cancelled) return; setResults({ tracks: [], playlists: [] }); setFailure(error.message); }).finally(() => { if (!cancelled) setSearching(false); }); }, 400);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [query]);
  const shelf = useMemo(() => { const own = playlists.filter(list => !pinned.some(item => item.uri === list.uri)); return [...pinned.map(item => ({ id: item.uri, uri: item.uri, name: item.name, cover: item.cover, tracks: item.tracks ?? 0 })), ...own]; }, [pinned, playlists]);
  const togglePin = (list: SpotifyPlaylist) => setSpotify({ pinned: pinned.some(item => item.uri === list.uri) ? pinned.filter(item => item.uri !== list.uri) : [...pinned, { uri: list.uri, name: list.name, cover: list.cover, tracks: list.tracks }] });
  const card = (list: SpotifyPlaylist) => { const playing = now?.contextUri === list.uri; const isPinned = pinned.some(item => item.uri === list.uri); return <div key={list.uri} className={playing ? 'playlist-card playing' : 'playlist-card'}><button className="playlist-cover" aria-label={`Lancer ${list.name}`} style={list.cover ? { backgroundImage: `url(${list.cover})` } : undefined} onClick={() => void start(list.uri)}>{playing ? <AudioLines size={26} /> : list.cover ? null : <Music4 size={24} />}</button><button className="playlist-pin" aria-label={isPinned ? `Retirer ${list.name} des épinglées` : `Épingler ${list.name}`} aria-pressed={isPinned} onClick={() => togglePin(list)}>{isPinned ? <PinOff size={13} /> : <Pin size={13} />}</button><b>{list.name}</b><small>{list.tracks ? `${list.tracks} titres` : 'Playlist'}</small></div>; };
  return <section className="playlist-shelf">
    <header><h2>{results ? 'Résultats' : 'Vos playlists'}</h2><span>{results ? `${results.tracks.length + results.playlists.length} trouvés` : `${shelf.length} listes`}</span>
      <label className="media-search">{searching ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Chercher un titre, un artiste, une playlist" aria-label="Rechercher sur Spotify" spellCheck={false} />{query && <button aria-label="Effacer la recherche" onClick={() => setQuery('')}><X size={14} /></button>}</label>
    </header>
    {results ? <>{results.tracks.length > 0 && <div className="track-row">{results.tracks.map(track => <button key={track.uri} className={now?.title === track.name ? 'track-result playing' : 'track-result'} onClick={() => void startTracks([track.uri])}><span className="track-cover" style={track.cover ? { backgroundImage: `url(${track.cover})` } : undefined}><Play size={14} fill="currentColor" /></span><span><b>{track.name}</b><small>{track.artist}</small></span></button>)}</div>}
      {results.playlists.length > 0 && <div className="playlist-row">{results.playlists.map(card)}</div>}
      {failure && <p className="media-detail">{failure}</p>}{!searching && !failure && !results.tracks.length && !results.playlists.length && <p className="muted">Aucun résultat. Spotify ne rend plus ses playlists éditoriales accessibles aux applications tierces : cherchez plutôt un titre, un artiste ou une playlist créée par un utilisateur.</p>}</>
      : shelf.length > 0 ? <div className="playlist-row">{shelf.map(card)}</div> : null}
  </section>;
}
function DeviceList({ devices, command }: { devices: SpotifyDevice[]; command: ReturnType<typeof useSpotifyPlayer>['command'] }) {
  if (!devices.length) return null;
  return <div className="device-list" role="group" aria-label="Appareils Spotify">{devices.map(device => { const Icon = deviceIcon(device.type); return <button key={device.id ?? device.name} className={device.is_active ? 'chip active' : 'chip'} aria-pressed={device.is_active} disabled={!device.id} onClick={() => device.id && void command(client => client.transfer(device.id!))}><Icon size={13} />{device.name}</button>; })}</div>;
}
function HomeAssistantPlayer({ entity }: { entity: HassEntity }) {
  const demo = useAppStore(s => s.demo); const update = useAppStore(s => s.updateEntity); const notify = useAppStore(s => s.notify);
  const connection = useAppStore(s => s.connection); const [pending, setPending] = useState(false); const busy = useRef(false); const disabled = pending || unavailable(entity) || (!demo && connection !== 'connected');
  const volume = Number(entity.attributes.volume_level ?? 0);
  /** Same rule as the covers: the volume follows the finger locally and reaches Home Assistant once. */
  const [draft, setDraft] = useState(volume); useEffect(() => setDraft(volume), [volume]);
  const action = async (service: string, data: Record<string, unknown> = {}) => { if (busy.current || unavailable(entity)) return; busy.current = true; setPending(true); try { if (demo) { const state = service === 'media_play_pause' ? (entity.state === 'playing' ? 'paused' : 'playing') : entity.state; update({ ...entity, state, attributes: service === 'volume_set' ? { ...entity.attributes, volume_level: data.volume_level } : entity.attributes }); } else await callHomeAssistantService('media_player', service, data, { entity_id: entity.entity_id }); } catch (error) { setDraft(volume); notify({ kind: 'error', text: error instanceof Error ? error.message : 'Cette commande média a été refusée.' }); } finally { busy.current = false; setPending(false); } };
  const progress = Math.round(Number(entity.attributes.media_position ?? 0) / Number(entity.attributes.media_duration ?? 1) * 100);
  return <article className="now-playing" aria-busy={pending}><div className="album-art" style={entity.attributes.entity_picture ? { backgroundImage: `url(${String(entity.attributes.entity_picture)})` } : undefined}><span>♪</span></div><div className="track"><p>{String(entity.attributes.media_album_name ?? 'Aucun album')}</p><h2>{String(entity.attributes.media_title ?? 'Aucune lecture en cours')}</h2><span>{String(entity.attributes.media_artist ?? 'Choisissez une musique dans votre application habituelle.')}</span><div className="progress"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div><p className="media-detail" role="status">{pending ? 'Envoi…' : unavailable(entity) ? 'Lecteur indisponible' : !demo && connection !== 'connected' ? 'Hors connexion' : entity.state === 'playing' ? 'Lecture en cours' : 'En pause'}</p><div className="media-controls"><button disabled={disabled} aria-label="Précédent" onClick={() => void action('media_previous_track')}><SkipBack /></button><button disabled={disabled} className="play-button" aria-label="Lecture ou pause" onClick={() => void action('media_play_pause')}>{entity.state === 'playing' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button disabled={disabled} aria-label="Suivant" onClick={() => void action('media_next_track')}><SkipForward /></button><button disabled={disabled} aria-label="Répéter" onClick={() => void action('repeat_set', { repeat: entity.attributes.repeat === 'all' ? 'off' : 'all' })}><Repeat size={19} /></button></div><label className="volume"><Volume2 size={18} /><input disabled={disabled} aria-label="Volume" type="range" min="0" max="1" step="0.01" value={draft} onChange={e => setDraft(Number(e.target.value))} onPointerUp={() => draft !== volume && void action('volume_set', { volume_level: draft })} onKeyUp={() => draft !== volume && void action('volume_set', { volume_level: draft })} /></label></div></article>;
}
