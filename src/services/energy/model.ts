import type { EntityMapping, HassEntity } from '../../types/homeAssistant';
import { numberState, unavailable } from '../../utils/entities';

export const slots = [
  { key: 'blueHC', label: 'Bleu · HC', color: 'bleu', offPeak: true, id: 'sensor.lixee_easf01' },
  { key: 'blueHP', label: 'Bleu · HP', color: 'bleu', offPeak: false, id: 'sensor.lixee_easf02' },
  { key: 'whiteHC', label: 'Blanc · HC', color: 'blanc', offPeak: true, id: 'sensor.lixee_easf03' },
  { key: 'whiteHP', label: 'Blanc · HP', color: 'blanc', offPeak: false, id: 'sensor.lixee_easf04' },
  { key: 'redHC', label: 'Rouge · HC', color: 'rouge', offPeak: true, id: 'sensor.lixee_easf05' },
  { key: 'redHP', label: 'Rouge · HP', color: 'rouge', offPeak: false, id: 'sensor.lixee_easf06' },
] as const;
export type SlotKey = typeof slots[number]['key'];
export type Rates = Partial<Record<SlotKey, number>>;
export const n = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
export const euro = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
export function tempoColor(value?: string) {
  const key = (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return key.includes('bleu') || key.includes('blue') ? 'bleu' : key.includes('blanc') || key.includes('white') ? 'blanc' : key.includes('rouge') || key.includes('red') ? 'rouge' : undefined;
}
export function tempoEntities(entities: Record<string, HassEntity>, mapping: EntityMapping) {
  const pick = (mapped: string | undefined, fallback: string) => {
    const chosen = mapped ? entities[mapped] : undefined;
    return !unavailable(chosen) && tempoColor(chosen?.state) ? chosen : entities[fallback];
  };
  return { today: pick(mapping.tempoToday, 'sensor.rte_tempo_couleur_actuelle'), tomorrow: pick(mapping.tempoTomorrow, 'sensor.rte_tempo_prochaine_couleur') };
}
export function activeSlot(entities: Record<string, HassEntity>) {
  const index = numberState(entities['sensor.lixee_ntarf']);
  if (index != null && Number.isInteger(index) && index >= 1 && index <= 6) return slots[index - 1];
  const label = entities['sensor.lixee_current_price']?.state;
  const color = tempoColor(label);
  const hc = label?.toUpperCase().includes('HC');
  return color && label && /H[CP]/i.test(label) ? slots.find(slot => slot.color === color && slot.offPeak === hc) : undefined;
}
/** Calendar boundaries explicitly follow the household timezone, including DST. */
export function parisParts(time: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(time);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}
export function parisTime(year: number, month: number, day: number, hour = 0) {
  const target = Date.UTC(year, month - 1, day, hour);
  let result = target;
  for (let i = 0; i < 3; i++) {
    const p = parisParts(result);
    result += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour);
  }
  return result;
}
export function periodStart(now: number, period: 'day' | 'week' | 'month') {
  const p = parisParts(now);
  return parisTime(+p.year, +p.month, period === 'month' ? 1 : +p.day - (period === 'week' ? 6 : 0));
}
export function nextOffPeak(now: number) {
  const p = parisParts(now); const hour = +p.hour;
  const start = parisTime(+p.year, +p.month, +p.day + (hour < 6 ? -1 : 0), 22);
  const end = parisTime(+p.year, +p.month, +p.day + (hour >= 22 ? 1 : hour < 6 ? 0 : 1), 6);
  return { start, end, active: hour < 6 || hour >= 22 };
}
export interface Statistic { start: number; end: number; change: number | null }
export type Statistics = Record<string, Statistic[]>;
export function summarizeStatistics(data: Statistics, rates: Rates, start: number, end: number) {
  const byTime = new Map<number, { time: number; value: number; hc: number; hp: number }>();
  let last = 0;
  const totals = slots.map(slot => {
    const points = (data[slot.id] ?? []).filter(p => p.start >= start && p.start < end && p.change != null && Number.isFinite(p.change) && p.change >= 0);
    for (const p of points) {
      last = Math.max(last, Math.min(p.end, end));
      const bucket = byTime.get(p.start) ?? { time: p.start, value: 0, hc: 0, hp: 0 };
      bucket.value += p.change!; bucket[slot.offPeak ? 'hc' : 'hp'] += p.change!; byTime.set(p.start, bucket);
    }
    const value = points.length ? points.reduce((sum, p) => sum + p.change!, 0) : null;
    return { ...slot, value, cost: value === 0 ? 0 : value != null && rates[slot.key] != null ? value * rates[slot.key]! : null };
  });
  const complete = totals.every(t => t.value != null);
  const any = totals.some(t => t.value != null);
  const costKnown = any && totals.every(t => t.cost != null);
  return { totals, complete, last, total: any ? totals.reduce((sum, t) => sum + (t.value ?? 0), 0) : null, cost: costKnown ? totals.reduce((sum, t) => sum + t.cost!, 0) : null, bars: [...byTime.values()].sort((a, b) => a.time - b.time) };
}

/** Import existing HA prices, including the pre-2026 nested grid schema. */
export function ratesFromPreferences(payload: unknown): Rates {
  const sources = (payload as { energy_sources?: Array<Record<string, unknown>> })?.energy_sources ?? [];
  const rates: Rates = {};
  for (const source of sources) {
    if (source.type !== 'grid') continue;
    const flows = Array.isArray(source.flow_from) ? source.flow_from : [source];
    for (const flow of flows) {
      const slot = slots.find(s => s.id === flow.stat_energy_from);
      const price = flow.number_energy_price;
      if (slot && typeof price === 'number' && Number.isFinite(price) && price >= 0) rates[slot.key] = price;
    }
  }
  return rates;
}
