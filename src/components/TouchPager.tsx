import { Children, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';

export function TouchPager({ children, labels }: { children: ReactNode; labels: string[] }) {
  const panels = Children.toArray(children); const track = useRef<HTMLDivElement>(null); const [page, setPage] = useState(0);
  const go = (index: number) => { setPage(index); track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: useAppStore.getState().preferences.reducedMotion ? 'auto' : 'smooth' }); };
  return <div className="touch-pager"><div className="touch-track" ref={track} onScroll={event => { const width = event.currentTarget.clientWidth; if (width) setPage(Math.round(event.currentTarget.scrollLeft / width)); }}>
    {panels.map((panel, i) => <div className="touch-screen" key={i} role="region" aria-label={labels[i]} inert={i !== page}>{panel}</div>)}
  </div><div className="touch-navigation"><button disabled={page === 0} onClick={() => go(page - 1)} aria-label="Écran précédent">←</button><div className="touch-tabs" role="group" aria-label="Écrans de la page">{panels.map((_, i) => <button key={i} aria-current={page === i ? 'page' : undefined} className={page === i ? 'selected' : ''} onClick={() => go(i)}>{labels[i]}</button>)}</div><button disabled={page === panels.length - 1} onClick={() => go(page + 1)} aria-label="Écran suivant">→</button></div></div>;
}
export function PagedItems({ children, size = 4 }: { children: ReactNode; size?: number }) {
  const items = Children.toArray(children); const [page, setPage] = useState(0); const last = Math.max(0, Math.ceil(items.length / size) - 1); const current = Math.min(page, last);
  return <><div className="paged-items">{items.slice(current * size, (current + 1) * size)}</div>{last > 0 && <div className="items-navigation"><button aria-label="Éléments précédents" disabled={current === 0} onClick={() => setPage(current - 1)}>←</button><span>{current + 1} / {last + 1}</span><button aria-label="Éléments suivants" disabled={current === last} onClick={() => setPage(current + 1)}>→</button></div>}</>;
}
