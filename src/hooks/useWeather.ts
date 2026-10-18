import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchAir, fetchForecast, type Air, type Forecast } from '../services/weather/client';
const interval = 15 * 60_000;
interface WeatherState { forecast?: Forecast; air?: Air; loading: boolean; error?: string; airError?: string }
const useWeatherStore = create<WeatherState>(() => ({ loading: false }));
let pending: Promise<void> | undefined;
let lastAttempt = 0;
export function refreshWeather(force = false): Promise<void> {
  if (pending) return pending;
  if (!force && Date.now() - lastAttempt < interval) return Promise.resolve();
  lastAttempt = Date.now(); useWeatherStore.setState({ loading: true, error: undefined, airError: undefined });
  pending = Promise.allSettled([fetchForecast(), fetchAir()]).then(([weather, air]) => {
    if (weather.status === 'fulfilled') useWeatherStore.setState({ forecast: weather.value });
    else useWeatherStore.setState({ error: weather.reason instanceof Error ? weather.reason.message : 'Impossible de charger la météo.' });
    if (air.status === 'fulfilled') useWeatherStore.setState({ air: air.value });
    else useWeatherStore.setState({ airError: 'Qualité de l’air indisponible.' });
  }).finally(() => { pending = undefined; useWeatherStore.setState({ loading: false }); });
  return pending;
}
export function useWeather(enabled = true) {
  const state = useWeatherStore();
  useEffect(() => {
    if (!enabled) return;
    void refreshWeather();
    const update = () => { if (document.visibilityState === 'visible') void refreshWeather(); };
    const online = () => { void refreshWeather(true); };
    const timer = window.setInterval(update, interval);
    document.addEventListener('visibilitychange', update); window.addEventListener('online', online);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('online', online); };
  }, [enabled]);
  return { ...state, refresh: () => refreshWeather(true) };
}
