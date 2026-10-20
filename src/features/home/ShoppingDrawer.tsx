import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ListChecks, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { usePlanner } from '../../hooks/usePlanner';

type Planner = ReturnType<typeof usePlanner>;
export interface ClearRequest { source: string; ids: string[] }
interface Props {
  planner: Planner;
  draft: string;
  onDraft: (value: string) => void;
  initialClear?: ClearRequest;
  onClose: () => void;
}

export function ShoppingDrawer({ planner, draft, onDraft, initialClear, onClose }: Props) {
  const reducedMotion = useAppStore(s => s.preferences.reducedMotion);
  const dialog = useDialogFocus('[data-drawer-focus]:not(:disabled)');
  const input = useRef<HTMLInputElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [request, setRequest] = useState(initialClear);
  const [message, setMessage] = useState('');
  const dragStart = useRef<number | undefined>(undefined);
  const [dragOffset, setDragOffset] = useState(0);
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 }));
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const busyRef = useRef(planner.busy); busyRef.current = planner.busy;
  const pending = planner.items.filter(item => item.status !== 'completed');
  const completed = planner.items.filter(item => item.status === 'completed');
  const clearing = request && request.source === planner.todoSource;

  useEffect(() => {
    const update = () => setViewport({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current(); } };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    dialog.current?.addEventListener('keydown', escape);
    const element = dialog.current;
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      element?.removeEventListener('keydown', escape);
    };
  }, [dialog]);
  useEffect(() => { if (clearing) cancel.current?.focus(); else input.current?.focus({ preventScroll: true }); }, [clearing]);

  const clear = async () => {
    if (!request || request.source !== planner.todoSource) return;
    const success = await planner.clearItems(request.ids);
    setRequest(undefined);
    if (success) setMessage('Articles supprimés.');
  };
  const row = (item: Planner['items'][number]) => <div className="shopping-drawer-item" key={item.uid}>
    <button className="shopping-drawer-check" role="checkbox" aria-checked={item.status === 'completed'} aria-label={`${item.status === 'completed' ? 'Décocher' : 'Cocher'} ${item.summary}`} disabled={!planner.canCheck || planner.busy || Boolean(clearing)} onClick={() => void planner.toggleItem(item)}><i>{item.status === 'completed' && <Check size={15} />}</i><span>{item.summary}</span></button>
    {!clearing && <button className="shopping-drawer-remove" aria-label={`Supprimer ${item.summary}`} disabled={!planner.canRemove || planner.busy} onClick={() => void planner.removeItem(item)}><Trash2 size={17} /></button>}
  </div>;

  return createPortal(<div className="shopping-drawer-backdrop" style={{ height: viewport.height, top: viewport.top }} onPointerDown={event => { if (event.target === event.currentTarget && !planner.busy) onClose(); }}>
    <section ref={dialog} className="shopping-drawer" style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined} data-reduced-motion={reducedMotion} role="dialog" aria-modal="true" aria-labelledby="shopping-drawer-title" tabIndex={-1}>
      <div className="shopping-drawer-handle" aria-hidden="true" onPointerDown={event => {
        if (planner.busy) return;
        dragStart.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => { if (dragStart.current !== undefined) setDragOffset(Math.max(0, event.clientY - dragStart.current)); }} onPointerUp={event => {
        const distance = dragStart.current === undefined ? 0 : event.clientY - dragStart.current;
        dragStart.current = undefined; setDragOffset(0);
        if (distance >= 72 && !planner.busy) onClose();
      }} onPointerCancel={() => { dragStart.current = undefined; setDragOffset(0); }} />
      <header className="shopping-drawer-header"><div><ListChecks size={20} /><div><h2 id="shopping-drawer-title">{clearing ? 'Vider la liste ?' : 'Courses'}</h2><span>{pending.length} à acheter{completed.length ? ` · ${completed.length} coché${completed.length > 1 ? 's' : ''}` : ''}</span></div></div><button aria-label="Fermer les courses" disabled={planner.busy} onClick={onClose}><X size={21} /></button></header>
      {!clearing && <form className="shopping-quick-add" onSubmit={async event => {
        event.preventDefault();
        if (!draft.trim() || !planner.canAdd || planner.busy) return;
        if (await planner.addItem(draft)) { onDraft(''); setMessage('Article ajouté.'); input.current?.focus({ preventScroll: true }); }
      }}><label htmlFor="shopping-quick-input">Nouvel article</label><div><input ref={input} data-drawer-focus id="shopping-quick-input" aria-label="Article à ajouter" value={draft} onChange={event => { onDraft(event.target.value); setMessage(''); }} maxLength={200} placeholder="Ex. : lait, pain…" autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" readOnly={planner.busy} disabled={!planner.canAdd} /><button type="submit" disabled={!draft.trim() || !planner.canAdd || planner.busy}>{planner.busy && !planner.clearProgress ? <LoaderCircle size={18} className="spin" /> : <Plus size={18} />}Ajouter</button></div></form>}
      {clearing && <p className="shopping-clear-warning">Les {request.ids.length} article{request.ids.length > 1 ? 's' : ''} de cette liste seront supprimés, y compris les articles cochés.</p>}
      {planner.todoError && <p className="shopping-drawer-error" role="alert">{planner.todoError}</p>}
      {!planner.todoError && message && <p className="shopping-drawer-message" role="status">{message}</p>}
      <div className="shopping-drawer-content">
        {pending.map(row)}
        {completed.length > 0 && <details className="shopping-completed" open={Boolean(clearing) || undefined}><summary>Articles cochés ({completed.length})</summary>{completed.map(row)}</details>}
        {!planner.items.length && <div className="shopping-drawer-empty"><ListChecks size={30} /><p>La liste est vide</p><span>Ajoutez votre premier article ci-dessus.</span></div>}
      </div>
      <footer className="shopping-drawer-footer">{clearing ? <><button ref={cancel} data-drawer-focus disabled={planner.busy} onClick={() => setRequest(undefined)}>Annuler</button><button className="shopping-clear-action" disabled={planner.busy || !planner.canRemove} onClick={() => void clear()}>{planner.clearProgress ? <><LoaderCircle size={18} className="spin" />{planner.clearProgress.done} / {planner.clearProgress.total}</> : planner.busy ? 'Suppression…' : <><Trash2 size={18} />Vider la liste</>}</button></> : <><button className="shopping-clear-trigger" disabled={!planner.items.length || !planner.canRemove || planner.busy} onClick={() => { setMessage(''); setRequest({ source: planner.todoSource, ids: planner.items.map(item => item.uid) }); }}><Trash2 size={17} />Vider la liste</button><button className="shopping-drawer-done" disabled={planner.busy} onClick={onClose}>Terminer</button></>}</footer>
    </section>
  </div>, document.body);
}
