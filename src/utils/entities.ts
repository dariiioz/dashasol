import type { HassEntity } from '../types/homeAssistant';
export const unavailable = (entity?: HassEntity) => !entity || ['unavailable', 'unknown', 'none'].includes(entity.state);
export const numberState = (entity?: HassEntity) => { const value = Number(entity?.state); return Number.isFinite(value) ? value : undefined; };
export const domainOf = (id: string) => id.split('.')[0] ?? '';
export const labelOf = (entity?: HassEntity) => String(entity?.attributes.friendly_name ?? entity?.entity_id ?? 'Inconnu');
export const humanizeEntityId = (entityId: string) => entityId.split('.')[1]?.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) ?? entityId;
/** Display name for the whole interface: personal label first, then the Home Assistant name, then a readable entity id. */
export const nameOf = (labels: Record<string, string>, entity?: HassEntity, entityId?: string) => { const id = entity?.entity_id ?? entityId ?? ''; const label = labels[id]?.trim(); return label || String(entity?.attributes.friendly_name ?? '').trim() || (id ? humanizeEntityId(id) : 'Inconnu'); };
export const temperature = (value: number | undefined, unit = '°') => value === undefined ? '—' : `${Math.round(value * 10) / 10}${unit}`;
/** Home Assistant instances are not always metric: keep the typographic degree for Celsius, show the real unit otherwise. */
export const degreeUnit = (entity?: HassEntity, fallback = '°') => { const unit = String(entity?.attributes.unit_of_measurement ?? entity?.attributes.temperature_unit ?? '').trim(); return !unit || unit === '°C' ? fallback : unit; };
/** Honest freshness instead of a hardcoded "just now": a frozen sensor must be visible as such. */
export const freshness = (entity: HassEntity | undefined, now: Date) => { const stamp = Date.parse(entity?.last_updated ?? entity?.last_changed ?? ''); if (!Number.isFinite(stamp)) return 'Dernière mesure inconnue'; const minutes = Math.max(0, Math.round((now.getTime() - stamp) / 60_000)); if (minutes < 2) return 'Actualisé à l’instant'; if (minutes < 60) return `Actualisé il y a ${minutes} min`; const hours = Math.round(minutes / 60); return hours < 24 ? `Actualisé il y a ${hours} h` : `Actualisé il y a ${Math.round(hours / 24)} j`; };
export const feature = (entity: HassEntity | undefined, bit: number) => Boolean(Number(entity?.attributes.supported_features ?? 0) & bit);
const conditions: Record<string, string> = { 'clear-night': 'Nuit claire', cloudy: 'Nuageux', exceptional: 'Exceptionnel', fog: 'Brouillard', hail: 'Grêle', lightning: 'Orage', 'lightning-rainy': 'Orage et pluie', partlycloudy: 'Partiellement nuageux', pouring: 'Pluie battante', rainy: 'Pluvieux', snowy: 'Neigeux', 'snowy-rainy': 'Neige et pluie', sunny: 'Ensoleillé', windy: 'Venteux', 'windy-variant': 'Venteux' };
export const weatherLabel = (state?: string) => state ? conditions[state] ?? humanizeEntityId(`weather.${state}`) : 'Données météo en attente';
