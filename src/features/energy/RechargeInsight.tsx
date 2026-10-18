import { Clock3, PlugZap } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEnergyPrices } from '../../hooks/useEnergyPrices';
import { activeSlot, euro, n, nextOffPeak, slots, tempoColor, tempoEntities } from '../../services/energy/model';

export function RechargeInsight({ now }: { now: number }) {
  const entities = useAppStore(s => s.entities); const mapping = useAppStore(s => s.mapping); const connection = useAppStore(s => s.connection);
  const setPage = useAppStore(s => s.setPage); const { rates } = useEnergyPrices();
  const current = activeSlot(entities); const tempo = tempoEntities(entities, mapping); const next = nextOffPeak(now);
  const color = tempoColor(tempo.today?.state);
  const night = slots.find(slot => slot.color === color && slot.offPeak);
  const rate = night ? rates[night.key] : undefined;
  const difference = rate != null && current && rates[current.key] != null ? Math.max(0, rates[current.key]! - rate) : null;
  const connected = connection === 'connected';
  return <button className="recharge-insight" onClick={() => setPage('energy')} aria-label="Voir l’énergie, Tempo et les recharges">
    <PlugZap size={20} /><span><b>{!connected ? 'Tempo · connexion HA nécessaire' : next.active ? 'Heures creuses en cours' : 'Prochaine plage · 22 h – 6 h'}</b><small>{connected ? `${color ? `${color[0].toUpperCase()}${color.slice(1)}` : 'Couleur à confirmer'}${rate != null ? ` · ${n(rate, 4)} €/kWh` : ' · tarif à renseigner'}${difference != null && difference > 0 ? ` · ${euro(difference * 10)} de moins pour 10 kWh` : ''}` : 'Dernières valeurs conservées'}</small></span><Clock3 size={16} />
  </button>;
}
