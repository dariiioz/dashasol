// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeForecast } from '../services/weather/client';
const mocks = vi.hoisted(() => ({ weather: vi.fn(), air: vi.fn() }));
vi.mock('../services/weather/client', async importOriginal => ({ ...await importOriginal<typeof import('../services/weather/client')>(), fetchForecast: mocks.weather, fetchAir: mocks.air }));
import { refreshWeather, useWeather } from './useWeather';
afterEach(cleanup);
it('shares requests and retains last forecast while reporting failures independently', async () => {
 const forecast = normalizeForecast({ current: { time: 1792312200, temperature_2m: 9 }, hourly: { time: [] }, daily: { time: [] } });
 let resolve!: (value: typeof forecast) => void;
 mocks.weather.mockImplementationOnce(() => new Promise(r => { resolve = r; })); mocks.air.mockRejectedValue(new Error('Air down'));
 const { result } = renderHook(() => useWeather(false));
 await act(async () => {
   const first = refreshWeather(true); const second = refreshWeather(true);
   expect(first).toBe(second); resolve(forecast); await first;
 });
 expect(mocks.weather).toHaveBeenCalledTimes(1); expect(result.current.forecast).toEqual(forecast); expect(result.current.error).toBeUndefined(); expect(result.current.airError).toBeTruthy();
 mocks.weather.mockRejectedValueOnce(new Error('Connexion interrompue'));
 await act(async () => { await refreshWeather(true); });
 expect(result.current.forecast).toEqual(forecast); expect(result.current.error).toBe('Connexion interrompue'); expect(result.current.loading).toBe(false);
 await refreshWeather(); expect(mocks.weather).toHaveBeenCalledTimes(2);
});
