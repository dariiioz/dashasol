import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { getHomeAssistantClient, callHomeAssistantService } from '../../hooks/useHomeAssistant';
import { household } from '../../utils/household';
import { unavailable } from '../../utils/entities';
type Item = { uid: string; summary: string; status: string };

export function ShoppingList() {
  const entity = useAppStore(s => s.entities[household.shopping]);
  const connection = useAppStore(s => s.connection); const demo = useAppStore(s => s.demo);
  const [items, setItems] = useState<Item[]>([]); const [draft, setDraft] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const mounted = useRef(true); const revision = useRef(0); const writing = useRef(false);
  const ready = demo || (connection === 'connected' && !unavailable(entity));
  const load = useCallback(async () => {
    const token = ++revision.current;
    if (demo) { setItems(old => old.length ? old : [{ uid: 'demo-bread', summary: 'Pain', status: 'needs_action' }, { uid: 'demo-fruit', summary: 'Fruits', status: 'needs_action' }]); return; }
    if (!entity || connection !== 'connected') return;
    setLoading(true); setError('');
    try {
      const client = getHomeAssistantClient(); if (!client) throw new Error('Home Assistant est déconnecté.');
      const response = await client.request<{ response?: Record<string, { items: Item[] }> }>({ type: 'call_service', domain: 'todo', service: 'get_items', service_data: {}, target: { entity_id: household.shopping }, return_response: true });
      const list = response.response?.[household.shopping]?.items;
      if (!Array.isArray(list)) throw new Error('La liste de courses n’a pas été retournée.');
      if (mounted.current && token === revision.current) setItems(list);
    } catch (e) { if (mounted.current && token === revision.current) setError(e instanceof Error ? e.message : 'Impossible de charger les courses.'); }
    finally { if (mounted.current && token === revision.current) setLoading(false); }
  }, [demo, connection, entity?.entity_id, entity?.state, entity?.last_updated]);
  useEffect(() => { mounted.current = true; void load(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000); return () => { mounted.current = false; revision.current++; window.clearInterval(timer); }; }, [load]);
  const change = async (service: 'add_item' | 'update_item', data: Record<string, unknown>) => {
    if (writing.current || !ready) return; writing.current = true; setBusy(true); setError('');
    try {
      if (demo) setItems(old => service === 'add_item' ? [...old, { uid: crypto.randomUUID(), summary: String(data.item), status: 'needs_action' }] : old.map(item => item.uid === data.item ? { ...item, status: String(data.status) } : item));
      else { await callHomeAssistantService('todo', service, data, { entity_id: household.shopping }); await load(); }
      if (service === 'add_item' && mounted.current) setDraft('');
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'La modification a échoué.'); }
    finally { writing.current = false; if (mounted.current) setBusy(false); }
  };
  if (!demo && !entity) return <section className="house-panel"><h2>Courses</h2><p className="muted">La liste de courses est indisponible dans Home Assistant.</p></section>;
  return <section className="house-panel shopping-panel"><div className="house-panel-heading"><h2>Les courses</h2><button onClick={() => void load()} disabled={loading || busy || !ready}>Actualiser</button></div>
    {demo && <p className="history-note">Liste de démonstration</p>}
    <form className="shopping-add" onSubmit={e => { e.preventDefault(); if (draft.trim()) void change('add_item', { item: draft.trim() }); }}><input aria-label="Ajouter un article aux courses" placeholder="Ajouter du lait, du pain…" maxLength={200} value={draft} onChange={e => setDraft(e.target.value)} disabled={!ready || busy} /><button disabled={!ready || busy || !draft.trim()}>Ajouter</button></form>
    {error && <p className="house-error" role="alert">{error}</p>}
    {!ready && <p className="muted">Reconnectez Home Assistant pour modifier les courses.</p>}
    {loading && <p role="status" className="history-note">Chargement des courses…</p>}
    <ul className="shopping-items">{[...items].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')).map(item => <li key={item.uid}><label><input type="checkbox" checked={item.status === 'completed'} disabled={busy || !ready} onChange={() => void change('update_item', { item: item.uid, status: item.status === 'completed' ? 'needs_action' : 'completed' })} /><span className={item.status === 'completed' ? 'completed' : ''}>{item.summary}</span></label></li>)}</ul>
    {!loading && !error && !items.length && <p className="muted">La liste est vide. Ajoutez votre premier article.</p>}
  </section>;
}
