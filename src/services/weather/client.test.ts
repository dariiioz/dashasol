import { afterEach, expect, it, vi } from 'vitest';
import { fetchForecast, formatValue, localDate, localTime, normalizeForecast, weatherCondition } from './client';
afterEach(() => vi.unstubAllGlobals());
const response = { current: { time: 1792312200, temperature_2m: 0, is_day: 0 }, hourly: { time: [1792310400, 1792314000], temperature_2m: [0, null], precipitation_probability: [0, 80] }, daily: { time: [1792274400], temperature_2m_min: [-2], temperature_2m_max: [8], sunrise: [1792305000], sunset: [1792343400] } };
it('converts Unix timestamps to instants, preserves zero and keeps gaps as null', () => {
 const data = normalizeForecast(response, 123);
 expect(data.current.time).toBe(1792312200000); expect(data.current.temperature).toBe(0); expect(data.current.day).toBe(false);
 expect(data.hours[0].probability).toBe(0); expect(data.hours[1].temperature).toBeNull(); expect(data.current.humidity).toBeNull();
 expect(data.days[0].sunrise).toBe(1792305000000); expect(data.days[0].rain).toBeNull(); expect(data.fetchedAt).toBe(123);
});
it('rejects malformed and unavailable current weather rather than showing zero degrees', () => {
 expect(() => normalizeForecast(null)).toThrow(); expect(() => normalizeForecast({ ...response, current: { time: 1792312200, temperature_2m: null } })).toThrow();
});
it('maps snow, freezing rain, storms, night and missing codes', () => {
 expect(weatherCondition(0, false)).toBe('clear-night'); expect(weatherCondition(66)).toBe('snowy-rainy'); expect(weatherCondition(85)).toBe('snowy'); expect(weatherCondition(99)).toBe('lightning-rainy'); expect(weatherCondition(null)).toBe('unknown');
});
it('formats Paris local time across the autumn clock change without guessing an offset', () => {
 expect(localTime(Date.parse('2026-10-25T00:30:00Z'))).toBe('02:30'); expect(localTime(Date.parse('2026-10-25T01:30:00Z'))).toBe('02:30'); expect(formatValue(null, '°')).toBe('—'); expect(formatValue(0, ' mm')).toBe('0 mm');
});
it('surfaces rate limiting and requests forecasts without Home Assistant credentials', async () => {
 const fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }); vi.stubGlobal('fetch', fetch);
 await expect(fetchForecast()).rejects.toThrow('Trop de demandes');
 const [url, options] = fetch.mock.calls[0]; expect(url).toContain('latitude=50.81294'); expect(url).toContain('forecast_days=10'); expect(options.headers).toBeUndefined();
});

it('keeps daily calendar dates distinct across the autumn change of offset', () => {
 const data = normalizeForecast({ ...response, daily: { ...response.daily, time: [Date.parse('2026-10-24T22:00:00Z') / 1000, Date.parse('2026-10-25T22:00:00Z') / 1000] } });
 expect(localDate(data.days[0].time, { day: 'numeric' })).toBe('25');
 expect(localDate(data.days[1].time, { day: 'numeric' })).toBe('26');
});
