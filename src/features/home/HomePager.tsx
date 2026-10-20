import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CarFront, House } from 'lucide-react';
const screens = [{ label: 'Maison', icon: House }, { label: 'ID.4', icon: CarFront }, { label: 'Agenda', icon: CalendarDays }];
export function HomePager({ viewport, reducedMotion }: { viewport: RefObject<HTMLDivElement | null>; reducedMotion: boolean }) {
  const [page, setPage] = useState(0);
  useEffect(() => { const element = viewport.current; if (!element) return; const update = () => setPage(Math.min(screens.length - 1, Math.max(0, Math.round(element.scrollLeft / (element.clientWidth + 10))))); element.addEventListener('scroll', update, { passive: true }); return () => element.removeEventListener('scroll', update); }, [viewport]);
  return createPortal(<nav className="home-mobile-pager" aria-label="Pages de l’accueil">{screens.map(({ label, icon: Icon }, index) => <button key={label} aria-current={page === index ? 'page' : undefined} onClick={() => { const element = viewport.current; element?.scrollTo({ left: index * (element.clientWidth + 10), behavior: reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}><Icon size={13} /><span>{label}</span></button>)}</nav>, document.body);
}
