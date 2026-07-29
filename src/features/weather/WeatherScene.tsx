import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { SkyPhase } from './sky';
type Props = { condition?: string; phase: SkyPhase; windSpeed?: number; reducedMotion?: boolean };
const normalize = (condition?: string) => (condition ?? 'unknown').toLowerCase().replaceAll('_', '-');
/** Deterministic scatter: the same weather always draws the same scene, without a random number in sight. */
const scatter = (count: number, build: (index: number) => CSSProperties) => Array.from({ length: count }, (_, index) => <i key={index} style={build(index)} />);
const cloudLayers = [{ top: '6%', width: '46%', speed: 64, opacity: .5, blur: 18 }, { top: '24%', width: '58%', speed: 46, opacity: .8, blur: 13 }, { top: '44%', width: '38%', speed: 82, opacity: .35, blur: 22 }, { top: '15%', width: '70%', speed: 96, opacity: .28, blur: 26 }, { top: '58%', width: '52%', speed: 54, opacity: .45, blur: 16 }];
export const WeatherScene = memo(function WeatherScene({ condition, phase, windSpeed, reducedMotion }: Props) {
  const kind = normalize(condition);
  const rainy = ['rainy', 'pouring', 'lightning-rainy', 'hail'].includes(kind); const pouring = kind === 'pouring' || kind === 'lightning-rainy';
  const snowy = ['snowy', 'snowy-rainy'].includes(kind); const foggy = kind === 'fog'; const stormy = kind.includes('lightning');
  const overcast = ['cloudy', 'rainy', 'pouring', 'lightning-rainy', 'snowy', 'snowy-rainy', 'hail', 'exceptional'].includes(kind);
  const clouds = foggy ? 0 : overcast ? 5 : ['partlycloudy', 'windy-variant'].includes(kind) ? 4 : 3;
  const gusty = ['windy', 'windy-variant'].includes(kind) || (windSpeed ?? 0) > 25;
  const wind = Math.min(60, Math.max(0, windSpeed ?? 8));
  const style = { '--gust': `${Math.max(3.5, 13 - wind / 5)}s`, '--drift': `${Math.max(26, 92 - wind)}s`, '--slant': `${Math.round(wind / 3)}px` } as CSSProperties;
  return <div className={`weather-scene ${kind} ${phase} ${overcast ? 'overcast' : ''} ${reducedMotion ? 'still' : ''}`} style={style} aria-hidden="true">
    {phase === 'night' && !overcast && <div className="stars">{scatter(24, index => ({ left: `${(index * 41) % 97}%`, top: `${(index * 23) % 68}%`, animationDelay: `-${(index % 11) * .7}s`, transform: `scale(${.55 + (index % 4) * .22})` }))}</div>}
    <i className="celestial"><i className="rays" /></i>
    <div className="clouds">{cloudLayers.slice(0, clouds).map((layer, index) => <i key={index} className="cloud" style={{ top: layer.top, width: layer.width, opacity: layer.opacity, filter: `blur(${layer.blur}px)`, animationDuration: `calc(var(--drift) * ${(layer.speed / 64).toFixed(2)})`, animationDelay: `-${index * 13}s` } as CSSProperties} />)}</div>
    {rainy && <><div className="rain">{scatter(pouring ? 30 : 16, index => ({ left: `${(index * 37) % 100}%`, animationDelay: `-${(index % 9) * .29}s`, animationDuration: `${(pouring ? .72 : 1.05) + (index % 5) * .14}s`, height: `${index % 4 ? 26 : 42}px` }))}</div><div className="splashes">{scatter(pouring ? 9 : 5, index => ({ left: `${8 + index * 11}%`, animationDelay: `-${(index % 5) * .43}s` }))}</div></>}
    {snowy && <div className="snow">{scatter(20, index => ({ left: `${(index * 47) % 100}%`, animationDelay: `-${(index % 10) * .9}s`, animationDuration: `${7 + (index % 6)}s`, width: `${3 + (index % 3)}px`, height: `${3 + (index % 3)}px` }))}</div>}
    {foggy && <div className="fog">{scatter(3, index => ({ top: `${28 + index * 21}%`, animationDelay: `-${index * 7}s`, opacity: .2 - index * .04 }))}</div>}
    {gusty && <div className="gusts">{scatter(4, index => ({ top: `${18 + index * 19}%`, width: `${28 + (index % 3) * 14}%`, animationDelay: `-${index * 1.6}s` }))}</div>}
    {stormy && <><i className="flash" /><i className="bolt" /></>}
  </div>;
});
