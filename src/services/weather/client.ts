export const location = { name: 'Marquise', latitude: 50.81294, longitude: 1.70786, timezone: 'Europe/Paris' };
export interface Reading { time: number; temperature: number | null; feels: number | null; humidity: number | null; code: number | null; day: boolean; wind: number | null; gust: number | null; direction: number | null; rain: number | null; pressure: number | null; cloud: number | null; probability: number | null; uv: number | null; visibility: number | null }
export interface Day { time: number; code: number | null; min: number | null; max: number | null; rain: number | null; probability: number | null; wind: number | null; gust: number | null; uv: number | null; sunrise: number | null; sunset: number | null; sunshine: number | null }
export interface Forecast { current: Reading; hours: Reading[]; days: Day[]; fetchedAt: number; demo?: boolean }
export interface Air { time: number; aqi: number | null; pm25: number | null; pm10: number | null; ozone: number | null; grass: number | null; birch: number | null; alder: number | null }
type Series = Record<string, unknown[]>;
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const value = (series: Series, field: string, i: number) => number(series[field]?.[i]);
function reading(get: (field: string) => unknown): Reading {
  return { time: Number(get('time')) * 1000, temperature: number(get('temperature_2m')), feels: number(get('apparent_temperature')), humidity: number(get('relative_humidity_2m')), code: number(get('weather_code')), day: get('is_day') === 1, wind: number(get('wind_speed_10m')), gust: number(get('wind_gusts_10m')), direction: number(get('wind_direction_10m')), rain: number(get('precipitation')), pressure: number(get('pressure_msl')), cloud: number(get('cloud_cover')), probability: number(get('precipitation_probability')), uv: number(get('uv_index')), visibility: number(get('visibility')) };
}
export function normalizeForecast(raw: unknown, fetchedAt = Date.now()): Forecast {
  const payload = raw as { current?: Record<string, unknown>; hourly?: Series; daily?: Series };
  if (!payload?.current || !Array.isArray(payload.hourly?.time) || !Array.isArray(payload.daily?.time)) throw new Error('Réponse météo incomplète.');
  const current = reading(field => payload.current![field]);
  if (!Number.isFinite(current.time) || current.temperature === null) throw new Error('Conditions météo indisponibles.');
  const hourly = payload.hourly!; const daily = payload.daily!;
  const hours = hourly.time.map((_, i) => reading(field => hourly[field]?.[i]));
  // Daily timestamps use the response’s fixed offset. Anchor date-only labels at noon
  // so the autumn DST change cannot label two consecutive days as Sunday.
  const days = daily.time.map((time, i): Day => ({ time: (Number(time) + 12 * 3600) * 1000, code: value(daily, 'weather_code', i), min: value(daily, 'temperature_2m_min', i), max: value(daily, 'temperature_2m_max', i), rain: value(daily, 'precipitation_sum', i), probability: value(daily, 'precipitation_probability_max', i), wind: value(daily, 'wind_speed_10m_max', i), gust: value(daily, 'wind_gusts_10m_max', i), uv: value(daily, 'uv_index_max', i), sunrise: value(daily, 'sunrise', i) === null ? null : Number(daily.sunrise[i]) * 1000, sunset: value(daily, 'sunset', i) === null ? null : Number(daily.sunset[i]) * 1000, sunshine: value(daily, 'sunshine_duration', i) }));
  return { current, hours, days, fetchedAt };
}
const currentFields = 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
export const forecastUrl = () => `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone, timeformat: 'unixtime', forecast_days: '10', current: currentFields, hourly: `${currentFields},precipitation_probability,uv_index,visibility`, daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunshine_duration' })}`;
async function get(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(response.status === 429 ? 'Trop de demandes météo. Réessayez dans quelques minutes.' : 'Le service météo est indisponible.');
  return response.json();
}
export async function fetchForecast(): Promise<Forecast> { return normalizeForecast(await get(forecastUrl())); }
export async function fetchAir(): Promise<Air> {
  const data = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone, timeformat: 'unixtime', current: 'european_aqi,pm10,pm2_5,ozone,grass_pollen,birch_pollen,alder_pollen' })}`);
  if (!data.current) throw new Error('Qualité de l’air indisponible.');
  const c = data.current;
  return { time: Number(c.time) * 1000, aqi: number(c.european_aqi), pm25: number(c.pm2_5), pm10: number(c.pm10), ozone: number(c.ozone), grass: number(c.grass_pollen), birch: number(c.birch_pollen), alder: number(c.alder_pollen) };
}
export function weatherCondition(code: number | null, day = true): string {
  if (code === null) return 'unknown';
  if (code === 0) return day ? 'sunny' : 'clear-night';
  if (code <= 2) return 'partlycloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'lightning-rainy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowy';
  if ([66, 67].includes(code)) return 'snowy-rainy';
  return [65, 82].includes(code) ? 'pouring' : 'rainy';
}
export function weatherText(code: number | null, day = true): string {
  return ({ sunny: 'Ciel dégagé', 'clear-night': 'Nuit claire', partlycloudy: 'Éclaircies', cloudy: 'Couvert', fog: 'Brouillard', 'lightning-rainy': 'Orages', snowy: 'Neige', 'snowy-rainy': 'Pluie verglaçante', pouring: 'Fortes pluies', rainy: 'Pluie', unknown: 'Conditions indisponibles' })[weatherCondition(code, day)]!;
}
export const formatValue = (value: number | null | undefined, unit = '', digits = 0) => value == null || !Number.isFinite(value) ? '—' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })}${unit}`;
export const localTime = (time: number | null | undefined) => time == null ? '—' : new Date(time).toLocaleTimeString('fr-FR', { timeZone: location.timezone, hour: '2-digit', minute: '2-digit' });
export const localDate = (time: number, options: Intl.DateTimeFormatOptions) => new Date(time).toLocaleDateString('fr-FR', { ...options, timeZone: location.timezone });
