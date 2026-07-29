import type { HassEntity } from '../../types/homeAssistant';
import { domainOf } from '../../utils/entities';
export interface Candidate { entity: HassEntity; score: number; reason: string }
const score = (entity: HassEntity, terms: readonly string[], domains: readonly string[]) => { const haystack = `${entity.entity_id} ${entity.attributes.friendly_name ?? ''} ${entity.attributes.device_class ?? ''}`.toLowerCase(); return (domains.includes(domainOf(entity.entity_id)) ? 40 : 0) + terms.reduce((n, t) => n + (haystack.includes(t) ? 12 : 0), 0); };
export function discoverCandidates(entities: HassEntity[], purpose: 'weather' | 'outdoorTemperature' | 'outdoorHumidity' | 'uv' | 'wind' | 'tempoToday' | 'temperatures' | 'climates' | 'covers' | 'mediaPlayers'): Candidate[] {
  const definitions = { weather: [['weather'], ['weather']], outdoorTemperature: [['température extérieure', 'outdoor', 'exterieur', 'extérieur'], ['sensor']], outdoorHumidity: [['humid', 'outdoor'], ['sensor']], uv: [['uv', 'ultraviolet'], ['sensor']], wind: [['vent', 'wind'], ['sensor']], tempoToday: [['tempo', 'couleur du jour', 'today', 'tomorrow', 'demain', 'color'], ['sensor']], temperatures: [['température', 'temperature'], ['sensor']], climates: [[], ['climate']], covers: [[], ['cover']], mediaPlayers: [[], ['media_player']] } as const;
  const [terms, domains] = definitions[purpose] as readonly [readonly string[], readonly string[]];
  return entities.map(entity => ({ entity, score: score(entity, terms, domains), reason: domains.includes(domainOf(entity.entity_id)) ? domainOf(entity.entity_id) : 'nom correspondant' })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
}
export function normalizeEntity(entity: HassEntity) { return { ...entity, domain: domainOf(entity.entity_id), name: String(entity.attributes.friendly_name ?? entity.entity_id), available: !['unknown', 'unavailable'].includes(entity.state) }; }
