import { describe, expect, it } from 'vitest';
import { cardinal, uvLevel } from './metrics';
describe('weather metrics', () => {
  it('turns a wind bearing into a readable direction', () => { expect(cardinal(0)).toBe('N'); expect(cardinal(250)).toBe('OSO'); expect(cardinal(359)).toBe('N'); expect(cardinal(-90)).toBe('O'); expect(cardinal('brise')).toBeUndefined(); });
  it('qualifies the UV index', () => { expect(uvLevel(1)?.label).toBe('Faible'); expect(uvLevel(7)?.label).toBe('Élevé'); expect(uvLevel(9)?.label).toBe('Très élevé'); expect(uvLevel(12)?.label).toBe('Extrême'); expect(uvLevel(undefined)).toBeUndefined(); });
});
