import { lazy, Suspense, useState } from 'react';
import { Music2, CarFront } from 'lucide-react';
import { QuickDrawer } from '../../components/QuickDrawer';
import { useAppStore } from '../../stores/appStore';
const SpotifySettings = lazy(() => import('../settings/SettingsPage').then(module => ({ default: module.SpotifySettings })));
export function HomeServiceShortcuts({ spotify, vehicle }: { spotify: boolean; vehicle: boolean }) {
  const [open, setOpen] = useState(false); const setPage = useAppStore(s => s.setPage);
  if (!spotify && !vehicle) return null;
  return <div className="home-service-shortcuts" aria-label="Services à connecter">{spotify && <button onClick={() => setOpen(true)}><Music2 size={16} /><span>Connecter Spotify</span></button>}{vehicle && <button onClick={() => setPage('vehicle')}><CarFront size={16} /><span>Connecter l’ID.4</span></button>}{open && <QuickDrawer title="Spotify" placement="bottom" onClose={() => setOpen(false)}><Suspense fallback={<p>Chargement…</p>}><div className="spotify-quick-settings"><SpotifySettings /></div></Suspense></QuickDrawer>}</div>;
}
