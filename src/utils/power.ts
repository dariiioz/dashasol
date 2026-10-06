import type { HassEntity } from '../types/homeAssistant';
import { unavailable } from './entities';

export function powerWatts(entity?: HassEntity): number | undefined {
  if (unavailable(entity) || !entity?.state.trim()) return undefined;
  const value = Number(entity.state);
  const factor = { W: 1, kW: 1000, MW: 1_000_000 }[String(entity.attributes.unit_of_measurement)];
  return Number.isFinite(value) && factor !== undefined ? value * factor : undefined;
}

export function formatPower(watts: number): string {
  return Math.abs(watts) >= 1000
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(watts / 1000)} kW`
    : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(watts)} W`;
}

export function isPowerSensor(entity: HassEntity): boolean {
  return entity.entity_id.startsWith('sensor.') && ['W', 'kW', 'MW'].includes(String(entity.attributes.unit_of_measurement));
}
