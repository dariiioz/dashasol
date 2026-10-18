import { BatteryCharging, CarFront, ChevronRight, PlugZap } from 'lucide-react';
import { useVehicle } from '../../hooks/useVehicle';
import { chargerLabel, useCharger } from '../../hooks/useCharger';
import { useClock } from '../../hooks/useClock';
import { useAppStore } from '../../stores/appStore';
import { chargeLabel, reportAge } from '../../services/vehicle/client';
import { formatValue as f } from '../../services/weather/client';
export function VehicleCard() {
  const demo = useAppStore(s => s.demo); const setPage = useAppStore(s => s.setPage); const reducedMotion = useAppStore(s => s.preferences.reducedMotion);
  const { session, error } = useVehicle(!demo); const charger = useCharger(!demo && session.phase === 'connected'); const now = useClock();
  const data = session.data; const report = reportAge(data?.reportedAt, now.getTime());
  const freshCharger = charger?.online && charger.data && now.getTime() - charger.data.readAt < 45000 ? charger.data : undefined;
  const charging = !error && session.phase === 'connected' && data?.chargingState === 'charging' && !reportAge(data.chargingReportedAt ?? data.reportedAt, now.getTime()).stale;
  const state = error || session.phase === 'reauth_required' || session.phase === 'consent_required' ? 'Connexion à vérifier' : data ? report.stale ? 'Dernier relevé Volkswagen' : chargeLabel(data.chargingState) : demo ? 'Connecter Volkswagen' : session.phase === 'connected' ? 'Données indisponibles' : 'Connecter Volkswagen';
  return <button className="home-vehicle-card" aria-label="Ouvrir mon ID.4" onClick={() => setPage('vehicle')} data-charging={charging} data-reduced-motion={reducedMotion}>
    <span className="home-vehicle-top"><span><CarFront size={17} />ID.4</span><ChevronRight size={17} /></span>
    <span className="home-vehicle-image"><img src="/vehicles/id4-front_right.png" alt="Volkswagen ID.4 grise" /></span>
    <span className="home-vehicle-values"><b>{f(data?.battery)}<small>%</small></b><span>{f(data?.range, ' km')}<small>d’autonomie</small></span></span>
    <span className="home-vehicle-track" aria-hidden="true"><i style={{ width: `${data?.battery ?? 0}%` }} /></span>
    <span className={`home-vehicle-state ${report.stale && data ? 'old' : ''}`}><BatteryCharging size={13} />{state}</span>
    {charger?.configured && <span className="home-vehicle-charger"><PlugZap size={13} /><span>{freshCharger ? chargerLabel(freshCharger.state) : 'Borne hors ligne'}</span><b>{freshCharger ? f(freshCharger.power, ' kW', 1) : '—'}</b></span>}
  </button>;
}
