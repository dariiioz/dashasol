export interface BufferedRange { start: number; end: number }
/** Ignore remote ranges after a discontinuity; jump only a small unplayable gap. */
export function playbackWindow(ranges: BufferedRange[], current: number, recover = false) {
  const range = ranges.find(range => range.end > current + .01 && range.start <= current + .35)
    ?? (recover ? ranges.find(range => range.end > current && range.start > current && range.start - current <= 8) : undefined);
  return range ? { ahead: range.end - Math.max(current, range.start), position: Math.max(current, range.start), end: range.end } : { ahead: 0, position: current, end: current };
}
export function bufferTarget(stalls: number) { return Math.min(6, 3 + Math.max(0, stalls) * .75); }
