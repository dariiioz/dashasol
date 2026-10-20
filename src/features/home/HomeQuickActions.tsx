import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Bell, Blinds } from 'lucide-react';
import { QuickDrawer } from '../../components/QuickDrawer';
import { CoverQuickCommands } from './CoverQuickCommands';

const Entry = lazy(() => import('../entry/EntryPage').then(module => ({ default: module.EntryPage })));

export function HomeQuickActions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<'covers' | 'entry'>();
  return <div className="home-quick-actions" role="group" aria-label="Accès rapides">
    <button aria-label="Ouvrir les volets" aria-haspopup="dialog" onClick={() => setOpen('covers')}><Blinds size={20} /><span>Volets</span></button>
    <button aria-label="Ouvrir la sonnette" aria-haspopup="dialog" onClick={() => setOpen('entry')}><Bell size={20} /><span>Entrée</span></button>
    {children}
    {open && <QuickDrawer title={open === 'covers' ? 'Volets' : 'Sonnette'} placement={open === 'covers' ? 'bottom' : 'auto'} onClose={() => setOpen(undefined)}><Suspense fallback={<p className="muted">Chargement…</p>}>{open === 'covers' ? <CoverQuickCommands /> : <div className="entry-quick-panel"><Entry /></div>}</Suspense></QuickDrawer>}
  </div>;
}
