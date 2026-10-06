export interface HistoryPoint { time: number; value: number | null }
export type TemperatureHistory = Record<string, HistoryPoint[]>;

/** Home Assistant's WebSocket history uses compressed s/lu keys and Unix seconds. */
export function normalizeHistory(payload: unknown, ids: string[], start: number, end: number): TemperatureHistory {
  const records = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return Object.fromEntries(ids.map(id => {
    const raw = Array.isArray(records[id]) ? records[id] as Record<string, unknown>[] : [];
    const points = raw.flatMap(state => {
      if (!state || typeof state !== 'object') return [];
      const stamp = state.lu ?? state.last_updated ?? state.lc ?? state.last_changed;
      const time = typeof stamp === 'number' ? stamp * 1000 : typeof stamp === 'string' ? Date.parse(stamp) : NaN;
      if (!Number.isFinite(time) || time > end) return [];
      const rawValue = state.s ?? state.state;
      const value = typeof rawValue === 'string' && rawValue.trim() || typeof rawValue === 'number' ? Number(rawValue) : NaN;
      return [{ time, value: Number.isFinite(value) ? value : null }];
    }).sort((a, b) => a.time - b.time);
    const before = points.filter(point => point.time < start).at(-1);
    const inRange = points.filter(point => point.time >= start);
    if (before) inRange.unshift({ ...before, time: start });
    return [id, [...new Map(inRange.map(point => [point.time, point])).values()]];
  }));
}

/** Reduce busy sensors while preserving extrema and interruptions in recording. */
export function chartPoints(points: HistoryPoint[], limit = 600): HistoryPoint[] {
  if (points.length <= limit) return points;
  const size = Math.ceil(points.length / Math.max(1, Math.floor(limit / 5)));
  const sampled: HistoryPoint[] = [];
  for (let index = 0; index < points.length; index += size) {
    const bucket = points.slice(index, index + size);
    const numeric = bucket.filter(point => point.value !== null);
    const min = numeric.reduce<HistoryPoint | undefined>((a, b) => !a || b.value! < a.value! ? b : a, undefined);
    const max = numeric.reduce<HistoryPoint | undefined>((a, b) => !a || b.value! > a.value! ? b : a, undefined);
    const chosen = [bucket[0], min, max, bucket.find(point => point.value === null), bucket.at(-1)].filter((point): point is HistoryPoint => Boolean(point));
    sampled.push(...[...new Map(chosen.map(point => [point.time, point])).values()].sort((a, b) => a.time - b.time));
  }
  // Keep both sides of every recording interruption, even in the same bucket.
  for (let index = 0; index < points.length; index++) {
    if (points[index].value === null && (index === 0 || points[index - 1].value !== null)) {
      if (index > 0) sampled.push(points[index - 1]);
      sampled.push(points[index]);
    } else if (points[index].value !== null && index > 0 && points[index - 1].value === null) sampled.push(points[index]);
  }
  return [...new Map(sampled.map(point => [point.time, point])).values()].sort((a, b) => a.time - b.time);
}

export function demoHistory(ids: string[], start: number, end: number, values: Record<string, number>, kind: 'temperature' | 'power' = 'temperature'): TemperatureHistory {
  const interval = Math.max(5 * 60_000, (end - start) / 240);
  return Object.fromEntries(ids.map(id => {
    const phase = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 12;
    const base = values[id];
    if (!Number.isFinite(base)) return [id, []];
    const points: HistoryPoint[] = [];
    for (let time = start; time <= end; time += interval) {
      const value = kind === 'power'
        ? base * (.8 + .25 * Math.sin(time / 3_600_000 + phase)) + Math.abs(base) * Math.max(0, Math.sin(time / 1_800_000 + phase)) ** 8
        : base + .7 * Math.sin(time / 3_600_000 + phase) + .25 * Math.sin(time / 900_000 + phase);
      const precision = kind === 'power' ? 1000 : 10;
      points.push({ time, value: Math.round(value * precision) / precision });
    }
    points.push({ time: end, value: base });
    return [id, points];
  }));
}
