import { RechargeInsight } from '../energy/RechargeInsight';
import { useAppStore } from '../../stores/appStore';
import { BatteryCharging, Clock3, PlugZap, Thermometer, Zap } from 'lucide-react';
import { chargerLabel, type ChargerStatus } from '../../hooks/useCharger';
import { formatValue as f } from '../../services/weather/client';
export function ChargerPanel({ status, now }: { status: ChargerStatus | undefined; now: number }) {
  const reducedMotion = useAppStore(s => s.preferences.reducedMotion);
  const data = status?.data; const fresh = !!status?.online && !!data && now - data.readAt < 45000;
  if (!data) return <div className="vehicle-connect"><PlugZap size={48} /><p>{status?.configured === false ? 'Aucune borne configurée sur le service local.' : status?.message ?? 'Connexion à la borne Dé…'}</p></div>;
  return <div className="charger-panel" data-reduced-motion={reducedMotion}>
    <article className="charger-summary" data-charging={fresh && data.state === 'charging'}><div className="charger-summary-top"><span><PlugZap size={19} />dé · Borne</span><small className={fresh ? 'charger-online' : 'vehicle-old'}>{fresh ? 'Connexion locale' : 'Hors ligne · ancien relevé'}</small></div><div className="charger-power"><strong>{f(data.power, '', 2)}</strong><span>kW</span></div><p>{chargerLabel(data.state)}{data.hasAlarm ? ' · Alarme signalée' : ''}</p><div className="charger-energy"><BatteryCharging size={20} /><b>{f(data.energy, ' kWh', 2)}</b><span>Session en cours / dernière valeur</span></div><small><Clock3 size={12} />Relevé à {new Date(data.readAt).toLocaleTimeString('fr-FR')}</small>{status?.message && <small role="status">{status.message}</small>}</article>
    <div className="charger-measurements"><RechargeInsight now={now} /><article className="charger-limits"><span><Zap size={17} />Consigne<b>{f(data.currentLimit, ' A')}</b></span><span><Thermometer size={17} />Température<b>{f(data.temperature, ' °C', 1)}</b></span></article>{data.phases.map(phase => <article className="charger-phase" key={phase.name}><span>{phase.name}</span><div><small>Tension</small><b>{f(phase.voltage, ' V', 1)}</b></div><div><small>Intensité</small><b>{f(phase.current, ' A', 1)}</b></div></article>)}</div>
  </div>;
}
