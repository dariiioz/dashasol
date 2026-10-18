import { expect, it } from 'vitest';
import { bufferTarget, playbackWindow } from './playback';
it('keeps a reserve and increases it only after an actual stall', () => {
  expect(bufferTarget(0)).toBe(3); expect(bufferTarget(2)).toBe(4.5); expect(bufferTarget(100)).toBe(6);
});
it('measures only the playable range and bridges a small muxing gap', () => {
  expect(playbackWindow([{ start: 0, end: 3 }, { start: 3.15, end: 7 }], 3.01)).toEqual({ ahead: 3.85, position: 3.15, end: 7 });
  expect(playbackWindow([{ start: 0, end: 3 }, { start: 10, end: 15 }], 3.01).ahead).toBe(0);
  expect(playbackWindow([{ start: 0, end: 3 }, { start: 10, end: 15 }], 3.01, true)).toEqual({ ahead: 5, position: 10, end: 15 });
  expect(playbackWindow([{ start: 0, end: 3 }, { start: 20, end: 25 }], 3.01, true).ahead).toBe(0);
});
