import { useState } from 'react';
import { Bell, CalendarDays, CarFront, CloudSun, Flame, House, Thermometer, Blinds, Music2, Settings, Zap, Grid2X2, MoreHorizontal } from 'lucide-react';
import { QuickDrawer } from '../components/QuickDrawer';
import { useAppStore } from '../stores/appStore';
import { navigationFavorites } from '../utils/preferences';
import type { Page } from '../types/homeAssistant';
export const pageNames: Record<Page, string> = { household: 'Votre maison', home: 'Accueil', energy: 'Énergie', weather: 'Météo', temperatures: 'Températures', heating: 'Chauffage', covers: 'Volets', media: 'Musique', vehicle: 'ID.4', entry: 'Entrée', planner: 'Agenda', settings: 'Réglages' };
const icons = { household: Grid2X2, home: House, energy: Zap, weather: CloudSun, temperatures: Thermometer, heating: Flame, covers: Blinds, media: Music2, vehicle: CarFront, entry: Bell, planner: CalendarDays, settings: Settings };
const housePages: Page[] = ['household', 'temperatures', 'heating', 'covers', 'energy'];
export function Navigation() {
  const active = useAppStore(s => s.activePage); const setPage = useAppStore(s => s.setPage); const preferences = useAppStore(s => s.preferences);
  const [menu, setMenu] = useState<'house' | 'more'>(); const favorites = navigationFavorites(preferences.navigationFavorites);
  const go = (page: Page) => { setMenu(undefined); setPage(page); };
  const pageButton = (page: Page) => { const Icon = icons[page]; return <button key={page} className={active === page ? 'active' : ''} onClick={() => go(page)} aria-label={pageNames[page]} aria-current={active === page ? 'page' : undefined}><Icon size={22} strokeWidth={1.8} /><span>{pageNames[page]}</span></button>; };
  return <><nav aria-label="Navigation principale">{pageButton('home')}<button className={housePages.includes(active) && !favorites.includes(active) ? 'active' : ''} aria-label="Maison" aria-haspopup="dialog" onClick={() => setMenu('house')}><Grid2X2 size={22} /><span>Maison</span></button>{favorites.map(pageButton)}<button className={active !== 'home' && !housePages.includes(active) && !favorites.includes(active) ? 'active' : ''} aria-label="Plus" aria-haspopup="dialog" onClick={() => setMenu('more')}><MoreHorizontal size={22} /><span>Plus</span></button></nav>{menu && <QuickDrawer title={menu === 'house' ? 'Maison' : 'Plus'} placement="bottom" onClose={() => setMenu(undefined)}><div className="navigation-grid">{(menu === 'house' ? housePages : (Object.keys(pageNames) as Page[]).filter(page => page !== 'home' && !housePages.includes(page))).map(pageButton)}</div></QuickDrawer>}</>;
}
