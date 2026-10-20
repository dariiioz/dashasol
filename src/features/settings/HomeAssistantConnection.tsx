import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { testHomeAssistantConnection } from '../../services/home-assistant/connection';
export function HomeAssistantConnection() {
  const config = useAppStore(s => s.config); const replace = useAppStore(s => s.replaceConnection);
  const [editing, setEditing] = useState(false); const [url, setUrl] = useState(config?.url ?? ''); const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>(); const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setError(undefined);
    let parsed: URL;
    try { parsed = new URL(url.trim()); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error(); }
    catch { setError('Indiquez une adresse Home Assistant valide en http:// ou https://.'); return; }
    if (window.location.protocol === 'https:' && parsed.protocol !== 'https:') { setError('Cette application est en HTTPS : utilisez une adresse Home Assistant en HTTPS.'); return; }
    const next = { ...config, url: parsed.toString().replace(/\/$/, ''), token: token.trim() || config?.token || '', homeName: config?.homeName || 'La maison' };
    if (!next.token) { setError('Ajoutez un jeton Home Assistant.'); return; }
    const test = new AbortController(); controller.current = test; setBusy(true);
    try { await testHomeAssistantConnection(next, test.signal); if (!test.signal.aborted) { replace(next); setToken(''); setEditing(false); useAppStore.getState().notify({ kind: 'success', text: 'Connexion enregistrée. Vos préférences sont conservées.' }); } }
    catch (failure) { if (!test.signal.aborted) setError(failure instanceof Error ? failure.message : 'Connexion impossible.'); }
    finally { if (!test.signal.aborted) setBusy(false); }
  };
  return editing ? <form className="connection-editor" onSubmit={event => void save(event)}><label>Adresse Home Assistant<input required type="url" value={url} onChange={event => setUrl(event.target.value)} disabled={busy} autoComplete="url" /></label><label>Nouveau jeton<input type="password" value={token} onChange={event => setToken(event.target.value)} disabled={busy} placeholder={config?.token ? 'Laisser vide pour conserver le jeton actuel' : 'Jeton d’accès longue durée'} autoComplete="off" /></label>{error && <p className="planner-error" role="alert">{error}</p>}<div className="settings-buttons"><button type="button" onClick={() => { controller.current?.abort(); setBusy(false); setEditing(false); setToken(''); }}>Annuler</button><button className="selected" disabled={busy}>{busy ? 'Test de connexion…' : 'Tester et enregistrer'}</button></div></form> : <button className="settings-edit-connection" onClick={() => { setUrl(config?.url ?? ''); setEditing(true); }}>Modifier la connexion</button>;
}
