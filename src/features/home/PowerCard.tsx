import { useState } from 'react';
import { Zap } from 'lucide-react';
import { PowerHistoryModal } from './PowerHistoryModal';
import { useAppStore } from '../../stores/appStore';
import { useClock } from '../../hooks/useClock';
import { useEntityName } from '../../hooks/useEntityName';
import { freshness } from '../../utils/entities';
import { formatPower, powerWatts } from '../../utils/power';

export function PowerCard() {
  const demo = useAppStore(s => s.demo);
  const entityId = useAppStore(s => s.mapping.power) ?? (demo ? 'sensor.maison_puissance' : undefined);
  const entity = useAppStore(s => s.entities[entityId ?? '']);
  const setPage = useAppStore(s => s.setPage);
  const connection = useAppStore(s => s.connection);
  const now = useClock(); const name = useEntityName();
  const watts = powerWatts(entity);
  const [open, setOpen] = useState(false);
  const content = <>
    <div className="power-card-title"><Zap size={19} /><p className="eyebrow">Électricité · maintenant</p>{demo && <span className="power-demo">Démo</span>}</div>
    {entityId ? <><strong>{watts === undefined ? '—' : formatPower(watts)}</strong><span>{watts !== undefined && watts < 0 ? 'Injection sur le réseau' : 'Puissance instantanée'}</span><small>{!demo && connection !== 'connected' ? 'Hors connexion · dernière valeur connue' : watts === undefined ? 'Mesure indisponible ou unité incompatible' : freshness(entity, now)}</small><p className="power-source">{name(entity ?? entityId)}</p></>
      : <><strong>—</strong><span>Suivez la puissance de la maison.</span><button onClick={() => setPage('settings')}>Choisir mon capteur</button></>}
  </>;
  return <>{entityId ? <button type="button" className="power-card power-card-trigger" aria-label="Consommation électrique instantanée · Voir l’historique sur 24 h" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{content}<span className="power-history-link">Voir les 24 dernières heures →</span></button>
    : <section className="power-card" aria-label="Consommation électrique instantanée">{content}</section>}
    {open && entityId && <PowerHistoryModal key={entityId} entityId={entityId} onClose={() => setOpen(false)} />}</>;
}
