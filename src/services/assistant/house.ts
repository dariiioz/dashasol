import type { DashboardEntityConfig, EntityLabels, EntityMapping, HassEntity } from '../../types/homeAssistant';
import { selectedIds } from '../../utils/dashboard';
import { degreeUnit, nameOf, numberState, unavailable, weatherLabel } from '../../utils/entities';
export interface HouseContext { entities: Record<string, HassEntity>; dashboard: DashboardEntityConfig; mapping: EntityMapping; labels: EntityLabels; homeName?: string }
/** A wall tablet holds hundreds of entities: only what the household chose to display is ever named to the model. */
const SECTION_LIMIT = 25;
const hvacLabels: Record<string, string> = { heat: 'chauffage', cool: 'climatisation', auto: 'automatique', off: 'éteint', heat_cool: 'chaud/froid', dry: 'déshumidification', fan_only: 'ventilation' };
const quickActions = (context: HouseContext) => [context.dashboard.automationLower, context.dashboard.automationUpper].flatMap(action => action?.entityId ? [action.entityId] : []);
/** The single list of entity ids the assistant may act on: everything else is invisible to it, and refused if invented. */
export const controllableIds = (context: HouseContext): string[] => [...new Set([...selectedIds(context.dashboard.climateEntities), ...selectedIds(context.dashboard.coverEntities), ...selectedIds(context.dashboard.mediaEntities), ...quickActions(context)])].filter(id => context.entities[id]);
const line = (context: HouseContext, id: string, detail: string) => `- ${id} « ${nameOf(context.labels, context.entities[id], id)} » : ${detail}`;
const climateDetail = (entity: HassEntity) => {
  const current = numberState(entity) ?? Number(entity.attributes.current_temperature); const target = Number(entity.attributes.temperature);
  return [Number.isFinite(current) ? `${current} ${degreeUnit(entity, '°C')} mesurés` : undefined, Number.isFinite(target) ? `consigne ${target} ${degreeUnit(entity, '°C')}` : undefined, `mode ${hvacLabels[entity.state] ?? entity.state}`, entity.attributes.hvac_action === 'heating' ? 'chauffe en ce moment' : undefined].filter(Boolean).join(', ');
};
/** Home Assistant reports 0 as fully closed and 100 as fully open: state alone would hide a shutter left half way. */
const coverDetail = (entity: HassEntity) => { const position = Number(entity.attributes.current_position); return Number.isFinite(position) ? `ouvert à ${Math.round(position)} %` : entity.state === 'open' ? 'ouvert' : entity.state === 'closed' ? 'fermé' : entity.state; };
const mediaDetail = (entity: HassEntity) => [entity.state === 'playing' ? 'en lecture' : entity.state === 'paused' ? 'en pause' : entity.state === 'off' ? 'éteint' : entity.state, [entity.attributes.media_artist, entity.attributes.media_title].filter(Boolean).join(' – ') || undefined].filter(Boolean).join(', ');
const section = (title: string, lines: string[]) => lines.length ? [`${title} :`, ...lines.slice(0, SECTION_LIMIT)] : [];
/** Compact French snapshot of the house, rebuilt at every question so the assistant never answers from stale values. */
export function houseDigest(context: HouseContext, now = new Date()): string {
  const { entities, mapping } = context; const weather = entities[mapping.weather ?? '']; const outdoor = entities[mapping.outdoorTemperature ?? '']; const humidity = entities[mapping.outdoorHumidity ?? ''];
  const outdoorValue = numberState(outdoor) ?? Number(weather?.attributes.temperature); const humidityValue = numberState(humidity) ?? Number(weather?.attributes.humidity); const uvValue = numberState(entities[mapping.uv ?? '']);
  const outside = [weather ? weatherLabel(weather.state) : undefined, Number.isFinite(outdoorValue) ? `${outdoorValue} ${degreeUnit(outdoor ?? weather, '°C')}` : undefined, Number.isFinite(humidityValue) ? `humidité ${Math.round(humidityValue)} %` : undefined, uvValue !== undefined ? `UV ${uvValue}` : undefined].filter(Boolean).join(', ');
  return [
    `Maison : ${context.homeName?.trim() || 'la maison'}. Nous sommes le ${new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}, il est ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
    outside ? `Dehors : ${outside}.` : 'Dehors : aucune donnée météo.',
    ...section('Températures intérieures', selectedIds(context.dashboard.temperatureEntities).filter(id => entities[id]).map(id => line(context, id, unavailable(entities[id]) ? 'indisponible' : `${entities[id]!.state} ${degreeUnit(entities[id], '°C')}`))),
    ...section('Chauffage (pilotable)', selectedIds(context.dashboard.climateEntities).filter(id => entities[id]).map(id => line(context, id, climateDetail(entities[id]!)))),
    ...section('Volets (pilotables)', selectedIds(context.dashboard.coverEntities).filter(id => entities[id]).map(id => line(context, id, coverDetail(entities[id]!)))),
    ...section('Musique (pilotable)', selectedIds(context.dashboard.mediaEntities).filter(id => entities[id]).map(id => line(context, id, mediaDetail(entities[id]!)))),
    ...section('Commandes rapides (pilotables)', quickActions(context).filter(id => entities[id]).map(id => line(context, id, 'automatisation à déclencher')))
  ].join('\n');
}
/** Kept short on purpose: every token here is paid on each question, and a wall assistant is asked the same things all day. */
export const systemPrompt = (digest: string) => `Tu es l'assistant vocal de Domoryx, un écran mural qui pilote une maison Home Assistant. Tu réponds en français, à l'oral : une à deux phrases courtes, sans listes, sans balisage, sans identifiant technique.

Règles :
- Pour répondre à une question sur la maison, sers-toi uniquement de l'état ci-dessous.
- Pour agir, appelle un outil avec l'identifiant exact d'une entité listée comme pilotable. N'invente jamais d'identifiant.
- Si la demande vise un équipement absent de la liste, dis simplement qu'il n'est pas disponible ici.
- Si une pièce est ambiguë, demande laquelle plutôt que d'agir au hasard.
- Après une action réussie, confirme en une phrase ce que tu viens de faire.

État actuel de la maison :
${digest}`;
