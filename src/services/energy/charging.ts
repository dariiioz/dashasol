import type { ChargeSession } from '../../hooks/useCharger';
import { parisParts, slots, tempoColor, type Rates } from './model';

export interface TariffPoint { time: number; color: ReturnType<typeof tempoColor> }
export function normalizeTariffHistory(payload: unknown, id: string): TariffPoint[] {
  const rows = (payload as Record<string, Array<Record<string, unknown>>>)?.[id];
  return (Array.isArray(rows) ? rows : []).flatMap<TariffPoint>(row => {
    const stamp = row.lu ?? row.last_updated ?? row.lc ?? row.last_changed;
    const time = typeof stamp === 'number' ? stamp * 1000 : typeof stamp === 'string' ? Date.parse(stamp) : NaN;
    return Number.isFinite(time) ? [{ time, color: tempoColor(String(row.s ?? row.state ?? '')) }] : [];
  }).sort((a, b) => a.time - b.time);
}
/** Never apply today's color to yesterday's recharge. Unknown history means unknown cost. */
export function sessionCost(session: ChargeSession, rates: Rates, colors: TariffPoint[]) {
  let cost = 0;
  for (const segment of session.segments) {
    if (!segment.kwh) continue;
    const point = colors.filter(point => point.time <= segment.time).at(-1);
    if (!point?.color) return null;
    const hour = +parisParts(segment.time).hour;
    const slot = slots.find(slot => slot.color === point.color && slot.offPeak === (hour < 6 || hour >= 22));
    const rate = slot && rates[slot.key];
    if (rate == null) return null;
    cost += segment.kwh * rate;
  }
  return cost;
}
