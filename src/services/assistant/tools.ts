import type { ToolSchema } from '../openrouter/client';
import { domainOf } from '../../utils/entities';
export interface ToolPlan { domain: string; service: string; data: Record<string, unknown>; entityId: string; confirmation: string }
export type ToolOutcome = ToolPlan | { error: string };
export const isPlan = (outcome: ToolOutcome): outcome is ToolPlan => !('error' in outcome);
/** Home Assistant accepts any setpoint; a household thermostat does not. These bounds are the ones the heating page uses. */
const MIN_TEMPERATURE = 7; const MAX_TEMPERATURE = 30;
const entityIdField = { type: 'string', description: 'Identifiant exact d’une entité listée comme pilotable, par exemple climate.salon.' };
export const assistantTools: ToolSchema[] = [
  { type: 'function', function: { name: 'set_temperature', description: 'Régler la consigne de température d’un radiateur ou thermostat.', parameters: { type: 'object', properties: { entity_id: entityIdField, temperature: { type: 'number', description: `Consigne en degrés, entre ${MIN_TEMPERATURE} et ${MAX_TEMPERATURE}.` } }, required: ['entity_id', 'temperature'] } } },
  { type: 'function', function: { name: 'set_hvac_mode', description: 'Allumer, éteindre ou changer le mode d’un chauffage.', parameters: { type: 'object', properties: { entity_id: entityIdField, mode: { type: 'string', enum: ['heat', 'cool', 'auto', 'off'], description: 'heat pour chauffer, off pour éteindre.' } }, required: ['entity_id', 'mode'] } } },
  { type: 'function', function: { name: 'set_cover_position', description: 'Ouvrir, fermer ou positionner un volet.', parameters: { type: 'object', properties: { entity_id: entityIdField, position: { type: 'number', description: '0 pour fermer complètement, 100 pour ouvrir complètement.' } }, required: ['entity_id', 'position'] } } },
  { type: 'function', function: { name: 'media_command', description: 'Piloter la lecture en cours sur une enceinte de la maison.', parameters: { type: 'object', properties: { entity_id: entityIdField, command: { type: 'string', enum: ['play', 'pause', 'next', 'previous', 'volume'], description: 'volume exige le paramètre level.' }, level: { type: 'number', description: 'Volume voulu de 0 à 100, uniquement pour la commande volume.' } }, required: ['entity_id', 'command'] } } },
  { type: 'function', function: { name: 'run_automation', description: 'Déclencher une des automatisations rapides de la maison.', parameters: { type: 'object', properties: { entity_id: entityIdField }, required: ['entity_id'] } } }
];
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const number = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; };
const mediaServices: Record<string, string> = { play: 'media_play', pause: 'media_pause', next: 'media_next_track', previous: 'media_previous_track' };
/** Pure translation from a model tool call to a Home Assistant service call, so nothing unverified ever reaches the house. */
export function planCall(name: string, args: Record<string, unknown>, allowed: Iterable<string>): ToolOutcome {
  const entityId = text(args.entity_id); const permitted = new Set(allowed);
  if (!entityId) return { error: 'Paramètre entity_id manquant.' };
  /** The model only ever sees the household's own selection: an id from outside it is a hallucination, not a shortcut. */
  if (!permitted.has(entityId)) return { error: `L’entité ${entityId} n’existe pas ou n’est pas pilotable depuis Domoryx. Utilise un identifiant de la liste.` };
  const domain = domainOf(entityId);
  const wrongDomain = (expected: string) => ({ error: `${entityId} n’est pas un équipement de type ${expected}.` });
  if (name === 'set_temperature') {
    if (domain !== 'climate') return wrongDomain('chauffage');
    const asked = number(args.temperature); if (asked === undefined) return { error: 'Température invalide.' };
    const temperature = Math.round(clamp(asked, MIN_TEMPERATURE, MAX_TEMPERATURE) * 2) / 2;
    return { domain: 'climate', service: 'set_temperature', data: { temperature }, entityId, confirmation: `Consigne réglée sur ${temperature} °C.${temperature === asked ? '' : ` La demande de ${asked} °C a été ramenée entre ${MIN_TEMPERATURE} et ${MAX_TEMPERATURE} °C.`}` };
  }
  if (name === 'set_hvac_mode') {
    if (domain !== 'climate') return wrongDomain('chauffage');
    const mode = text(args.mode).toLowerCase(); if (!['heat', 'cool', 'auto', 'off'].includes(mode)) return { error: 'Mode inconnu : utilise heat, cool, auto ou off.' };
    return { domain: 'climate', service: 'set_hvac_mode', data: { hvac_mode: mode }, entityId, confirmation: mode === 'off' ? 'Chauffage éteint.' : `Mode réglé sur ${mode}.` };
  }
  if (name === 'set_cover_position') {
    if (domain !== 'cover') return wrongDomain('volet');
    const asked = number(args.position); if (asked === undefined) return { error: 'Position invalide.' };
    const position = Math.round(clamp(asked, 0, 100));
    /** Not every shutter accepts a position: the extremes go through open/close, which every cover implements. */
    if (position === 0) return { domain: 'cover', service: 'close_cover', data: {}, entityId, confirmation: 'Volet fermé.' };
    if (position === 100) return { domain: 'cover', service: 'open_cover', data: {}, entityId, confirmation: 'Volet ouvert.' };
    return { domain: 'cover', service: 'set_cover_position', data: { position }, entityId, confirmation: `Volet ouvert à ${position} %.` };
  }
  if (name === 'media_command') {
    if (domain !== 'media_player') return wrongDomain('enceinte');
    const command = text(args.command).toLowerCase();
    if (command === 'volume') { const asked = number(args.level); if (asked === undefined) return { error: 'Niveau de volume manquant.' }; const level = Math.round(clamp(asked, 0, 100)); return { domain: 'media_player', service: 'volume_set', data: { volume_level: level / 100 }, entityId, confirmation: `Volume réglé à ${level} %.` }; }
    const service = mediaServices[command]; if (!service) return { error: 'Commande inconnue : utilise play, pause, next, previous ou volume.' };
    return { domain: 'media_player', service, data: {}, entityId, confirmation: { play: 'Lecture relancée.', pause: 'Lecture mise en pause.', next: 'Morceau suivant.', previous: 'Morceau précédent.' }[command]! };
  }
  if (name === 'run_automation') {
    if (!['automation', 'script'].includes(domain)) return wrongDomain('automatisation');
    return { domain, service: domain === 'script' ? 'turn_on' : 'trigger', data: {}, entityId, confirmation: 'Automatisation déclenchée.' };
  }
  return { error: `Outil inconnu : ${name}.` };
}
