import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react';
import { weatherCondition } from '../../services/weather/client';
export function WeatherIcon({ code, day = true, size = 24 }: { code: number | null; day?: boolean; size?: number }) {
  const Icon = ({ sunny: Sun, 'clear-night': Moon, partlycloudy: CloudSun, cloudy: Cloud, fog: CloudFog, rainy: CloudRain, pouring: CloudRain, snowy: CloudSnow, 'snowy-rainy': CloudSnow, 'lightning-rainy': CloudLightning })[weatherCondition(code, day)] ?? Cloud;
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
