import { useEffect, useMemo } from 'react';
import { RefreshCw, X, Zap } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useEntityName } from '../../hooks/useEntityName';
import { useTemperatureHistory } from '../../hooks/useTemperatureHistory';
import { formatReading, powerReading } from '../../utils/power';
import { TemperatureChart } from '../temperatures/TemperatureChart';

export function PowerHistoryModal({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const dialog = useDialogFocus();
  const entity = useAppStore(s => s.entities[entityId]);
  const demo = useAppStore(s => s.demo);
  const name = useEntityName();
  const history = useTemperatureHistory([entityId], 24, 'power');
  const unit = String(entity?.attributes.unit_of_measurement ?? '');
  const multiplier = ({ W: 1, kW: 1000, MW: 1_000_000, VA: 1, kVA: 1000 } as Record<string, number>)[unit];
  const points = useMemo(() => (history.data[entityId] ?? []).map(point => ({ ...point, value: point.value === null || multiplier === undefined ? null : point.value * multiplier })), [history.data, entityId, multiplier]);
  const reading = powerReading(entity); const watts = reading?.value;
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="power-history-modal" role="dialog" aria-modal="true" aria-label="Historique électrique sur 24 heures" tabIndex={-1}>
      <button className="modal-close" onClick={onClose} aria-label="Fermer l’historique électrique"><X size={20} /></button>
      <p className="eyebrow"><Zap size={16} /> Électricité</p>
      <h2>Les 24 dernières heures</h2>
      <p className="power-history-source">{name(entity ?? entityId)}</p>
      <div className="power-history-current"><strong>{watts === undefined ? '—' : formatReading(watts, reading?.apparent)}</strong><span>maintenant</span></div>
      <p className="history-note">{demo ? 'Courbe simulée · mode démonstration' : `${reading?.apparent ? 'Puissance apparente' : 'Puissance'} enregistrée par Home Assistant`}</p>
      {history.status === 'error' ? <div className="history-error" role="status"><p>{history.error}</p><span>Vérifiez que ce capteur est enregistré dans l’historique Home Assistant.</span></div>
        : <TemperatureChart points={points} start={history.start} end={history.end} unit="W" name={name(entity ?? entityId)} loading={history.status === 'loading'} formatValue={value => formatReading(value, reading?.apparent)} />}
      <div className="power-history-footer"><span>Actualisation toutes les 5 min</span><button className="history-refresh" disabled={history.status === 'loading'} onClick={history.reload}><RefreshCw size={16} className={history.status === 'loading' ? 'spin' : ''} /> Actualiser</button></div>
    </section>
  </div>;
}
