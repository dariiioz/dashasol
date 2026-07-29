import type { HassEntity } from '../../types/homeAssistant';
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';
/** The sky follows the real sun when Home Assistant exposes it, and the clock otherwise. */
export function skyPhase(sun: HassEntity | undefined, now: Date): SkyPhase {
  const elevation = Number(sun?.attributes.elevation);
  if (Number.isFinite(elevation)) { if (elevation > 8) return 'day'; if (elevation > -6) return sun?.attributes.rising ? 'dawn' : 'dusk'; return 'night'; }
  if (sun?.state === 'below_horizon') return 'night';
  const hour = now.getHours();
  return hour < 6 || hour >= 22 ? 'night' : hour < 8 ? 'dawn' : hour >= 20 ? 'dusk' : 'day';
}
/** Next horizon crossing, so the card always says something that will actually happen. */
export function horizonEvent(sun: HassEntity | undefined, phase: SkyPhase) {
  const rising = phase === 'night' || phase === 'dawn';
  const stamp = String(sun?.attributes[rising ? 'next_rising' : 'next_setting'] ?? '');
  const date = new Date(stamp);
  if (!stamp || Number.isNaN(date.getTime())) return undefined;
  return { label: rising ? 'Lever' : 'Coucher', time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
}
