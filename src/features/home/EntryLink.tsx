import { Camera } from 'lucide-react';
import { useEufy } from '../../hooks/useEufy';
import { useAppStore } from '../../stores/appStore';
import { useDoorbellStore } from '../../stores/doorbellStore';
export function EntryLink() {
  const demo = useAppStore(s => s.demo); const setPage = useAppStore(s => s.setPage); const { status } = useEufy(!demo);
  const openLive = useDoorbellStore(s => s.openLive);
  const device = status.devices.find(d => d.sn === status.selected); const available = status.phase === 'connected' && !!device?.liveAvailable;
  return <><button className="home-entry-link" aria-label={available ? 'Voir la sonnette en direct' : 'Connecter la sonnette'} aria-haspopup={available ? 'dialog' : undefined} onClick={() => available ? openLive() : setPage('entry')}><Camera size={15} /><span>{available ? 'Voir l’entrée' : 'Connecter la sonnette'}</span></button></>;
}
