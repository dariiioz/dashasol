import { getHomeAssistantClient } from '../../hooks/useHomeAssistant';
import { useAppStore } from '../../stores/appStore';
import type { PlannerEvent, ShoppingItem } from '../../stores/plannerStore';
export async function plannerService(domain: string, service: string, entityId: string, data: Record<string, unknown>, response = false) {
  const client = getHomeAssistantClient();
  if (!client || useAppStore.getState().connection !== 'connected') throw new Error('Home Assistant est déconnecté. Réessaie après la reconnexion.');
  return client.request<{ response?: Record<string, unknown> }>({ type: 'call_service', domain, service, target: { entity_id: entityId }, service_data: data, ...(response ? { return_response: true } : {}) });
}
export async function getShopping(entityId: string): Promise<ShoppingItem[]> {
  const result = await plannerService('todo', 'get_items', entityId, {}, true);
  const items = (result.response?.[entityId] as { items?: unknown })?.items;
  if (!Array.isArray(items)) throw new Error('La liste de courses reçue est invalide.');
  return items.filter(i => typeof i.uid === 'string' && typeof i.summary === 'string' && ['completed', 'needs_action'].includes(i.status));
}
export async function getEvents(entityId: string, start: Date, end: Date): Promise<PlannerEvent[]> {
  const result = await plannerService('calendar', 'get_events', entityId, { start_date_time: start.toISOString(), end_date_time: end.toISOString() }, true);
  const events = (result.response?.[entityId] as { events?: unknown })?.events;
  if (!Array.isArray(events)) throw new Error('Les événements reçus sont invalides.');
  return events.filter(e => typeof e.start === 'string' && typeof e.end === 'string').map((e, i) => ({ uid: typeof e.uid === 'string' ? e.uid : `${e.start}-${i}`, summary: typeof e.summary === 'string' ? e.summary : 'Événement', start: e.start, end: e.end, allDay: /^\d{4}-\d{2}-\d{2}$/.test(e.start), description: typeof e.description === 'string' ? e.description : undefined, location: typeof e.location === 'string' ? e.location : undefined }));
}
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function eventTime(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00').getTime() : Date.parse(value); }
export function overlaps(event: PlannerEvent, start: Date, end: Date) { return eventTime(event.start) < end.getTime() && eventTime(event.end) > start.getTime(); }
export function eventLabel(event: PlannerEvent) { return event.allDay ? 'Toute la journée' : new Date(event.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
export function validateEvent(summary: string, start: string, end: string) {
  if (!summary.trim()) throw new Error('Donne un nom à cet événement.');
  if (!Number.isFinite(eventTime(start)) || !Number.isFinite(eventTime(end)) || eventTime(end) <= eventTime(start)) throw new Error('La fin doit être après le début.');
}
