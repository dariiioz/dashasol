import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useWeather } from '../../hooks/useWeather';
import { useEufy } from '../../hooks/useEufy';
import { useVehicle } from '../../hooks/useVehicle';
import { useCharger } from '../../hooks/useCharger';
import { useSpotifyPlayer } from '../../hooks/useSpotify';
export function ServiceDiagnostics() {
  const demo = useAppStore(s => s.demo); const connection = useAppStore(s => s.connection); const detail = useAppStore(s => s.connectionDetail);
  const weather = useWeather(!demo); const eufy = useEufy(!demo, 10000); const vehicle = useVehicle(!demo); const charger = useCharger(!demo);
  const spotify = useSpotifyPlayer(!demo, { library: false, pollInterval: 60000 }); const [checking, setChecking] = useState(false);
  const channels = [eufy.status.channels?.push, eufy.status.channels?.mqtt, eufy.status.channels?.wiredP2p];
  const eufyIssue = eufy.status.pushRegistration === 'failed' || channels.some(channel => channel && channel.failed > 0);
  const eufyPending = channels.some(channel => channel && channel.pending > 0);
  const rows = [
    { name: 'Home Assistant', ok: connection === 'connected', text: connection === 'connected' ? 'Connecté' : detail ?? 'Reconnexion en cours' },
    { name: 'Météo', ok: !!weather.forecast && !weather.error, text: weather.error ? weather.forecast ? 'Dernières prévisions conservées' : 'Service indisponible' : weather.forecast ? 'Prévisions disponibles' : 'Lecture en cours' },
    { name: 'Spotify', ok: spotify.connected && ['ready', 'idle'].includes(spotify.status), text: !spotify.connected ? 'Non connecté' : spotify.status === 'error' ? spotify.detail ?? 'Connexion à vérifier' : spotify.status === 'loading' ? 'Vérification en cours' : 'Compte connecté' },
    { name: 'Sonnette Eufy', ok: eufy.serviceAvailable !== false && eufy.status.phase === 'connected' && !eufyIssue && !eufyPending, text: eufy.serviceAvailable === false ? 'Service local indisponible' : eufy.status.phase === 'connected' && eufyIssue ? 'Connectée · liaison à vérifier' : eufy.status.phase === 'connected' && eufyPending ? 'Connectée · initialisation des liaisons' : ({ connected: 'Connectée', disconnected: 'Compte à connecter', '2fa': 'Code de validation attendu', captcha: 'Vérification attendue', reauth_required: 'Compte à reconnecter' })[eufy.status.phase] },
    { name: 'Volkswagen', ok: vehicle.serviceAvailable !== false && vehicle.session.phase === 'connected' && !vehicle.error, text: vehicle.serviceAvailable === false ? 'Service local indisponible' : vehicle.error ? 'Lecture à vérifier' : ({ connected: 'Compte connecté', disconnected: 'Compte à connecter', otp_required: 'Code e-mail attendu', consent_required: 'Autorisation à confirmer', reauth_required: 'Compte à reconnecter' })[vehicle.session.phase] },
    { name: 'Borne', ok: !!charger?.online, text: !charger ? 'Vérification en cours' : !charger.configured ? 'Non configurée' : charger.online ? 'Connectée en local' : charger.message ?? 'Indisponible' },
  ];
  const retry = async () => { if (checking) return; setChecking(true); window.dispatchEvent(new Event('domoryx-charger-refresh')); await Promise.allSettled([weather.refresh(), eufy.run('status'), vehicle.retry(), spotify.connected ? spotify.refresh() : Promise.resolve()]); setChecking(false); };
  return <section className="settings-card service-diagnostics"><div className="diagnostics-heading"><h3>État des services</h3><button disabled={checking || demo} onClick={() => void retry()}>{checking ? 'Vérification…' : 'Vérifier'}</button></div>{demo ? <p>Les connexions réelles ne sont pas utilisées en démonstration.</p> : <ul>{rows.map(row => <li key={row.name}><span className="service-dot" data-ok={row.ok} /><b>{row.name}</b><span>{row.text}</span></li>)}</ul>}</section>;
}
