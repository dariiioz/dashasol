import { ConfirmationHost } from './components/ConfirmationHost';
import { confirmAction } from './stores/confirmationStore';
import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import { registerSW } from 'virtual:pwa-register'; import { App } from './app/App';
// Fonts are bundled and precached: a wall display on an isolated network must never fall back to a system serif.
import '@fontsource/dm-sans/latin-400.css'; import '@fontsource/dm-sans/latin-500.css'; import '@fontsource/dm-sans/latin-600.css'; import '@fontsource/dm-mono/latin-400.css'; import '@fontsource/dm-mono/latin-500.css'; import '@fontsource/playfair-display/latin-500.css'; import '@fontsource/playfair-display/latin-600.css'; import '@fontsource/playfair-display/latin-500-italic.css'; import '@fontsource/playfair-display/latin-600-italic.css';
import './styles.css';
import './features/home/home-dashboard.css';
const updateSW = registerSW({ onNeedRefresh() { window.dispatchEvent(new CustomEvent('domoryx-update')); } }); window.addEventListener('domoryx-update', () => { void confirmAction({ title: 'Une nouvelle version est disponible', description: 'Recharger l’application pour appliquer la mise à jour ?', confirmLabel: 'Mettre à jour' }).then(accepted => { if (accepted) void updateSW(true); }); }); createRoot(document.getElementById('root')!).render(<StrictMode><App /><ConfirmationHost /></StrictMode>);
import './improvements.css';
