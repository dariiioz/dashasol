import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useAppStore } from '../stores/appStore';

export function QuickDrawer({ title, children, onClose, placement = 'auto', initialFocusSelector }: { title: string; children: ReactNode; onClose: () => void; placement?: 'auto' | 'bottom'; initialFocusSelector?: string }) {
  const dialog = useDialogFocus(initialFocusSelector);
  const reduced = useAppStore(s => s.preferences.reducedMotion);
  const close = useRef(onClose); close.current = onClose;
  const start = useRef<number | undefined>(undefined);
  const [drag, setDrag] = useState(0);
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 }));
  useEffect(() => {
    const resize = () => setViewport({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close.current(); } };
    const element = dialog.current;
    element?.addEventListener('keydown', escape);
    window.visualViewport?.addEventListener('resize', resize); window.visualViewport?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
    return () => { element?.removeEventListener('keydown', escape); window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, [dialog]);
  return createPortal(<div className={`shopping-drawer-backdrop quick-drawer-backdrop${placement === 'bottom' ? ' quick-drawer-bottom' : ''}`} style={viewport} onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="shopping-drawer quick-drawer" style={drag ? { transform: `translateY(${drag}px)` } : undefined} data-reduced-motion={reduced} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="shopping-drawer-handle" aria-hidden="true" onPointerDown={event => { start.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (start.current !== undefined) setDrag(Math.max(0, event.clientY - start.current)); }} onPointerUp={event => { const distance = start.current === undefined ? 0 : event.clientY - start.current; start.current = undefined; setDrag(0); if (distance >= 72) onClose(); }} onPointerCancel={() => { start.current = undefined; setDrag(0); }} />
      <header className="shopping-drawer-header"><h2>{title}</h2><button aria-label={`Fermer ${title.toLowerCase()}`} onClick={onClose}><X size={21} /></button></header>
      <div className="quick-drawer-content">{children}</div>
    </section>
  </div>, document.body);
}
