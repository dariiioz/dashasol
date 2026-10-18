import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';
import { usePlannerStore, type PlannerEvent, type ShoppingItem } from '../stores/plannerStore';
import { eventTime, getEvents, getShopping, overlaps, plannerService, validateEvent } from '../services/planner/client';
export function usePlanner(start: Date, end: Date) {
  const entities = useAppStore(useShallow(s => Object.values(s.entities).filter(e => e.entity_id.startsWith('todo.') || e.entity_id.startsWith('calendar.'))));
  const connection = useAppStore(s => s.connection); const demo = useAppStore(s => s.demo);
  const store = usePlannerStore();
  const todos = entities.filter(e => e.entity_id.startsWith('todo.')); const calendars = entities.filter(e => e.entity_id.startsWith('calendar.'));
  const todoSource = demo ? 'local' : store.todoSource || todos.find(e => /shopping|courses/i.test(e.entity_id + e.attributes.friendly_name))?.entity_id || todos[0]?.entity_id || 'local';
  const calendarSource = demo ? 'local' : store.calendarSource || calendars.find(e => (Number(e.attributes.supported_features) & 1) !== 0)?.entity_id || 'local';
  const [remoteItems, setRemoteItems] = useState<{ source: string; items: ShoppingItem[] }>(); const [remoteEvents, setRemoteEvents] = useState<{ source: string; events: PlannerEvent[] }>();
  const [todoError, setTodoError] = useState<string>(); const [calendarError, setCalendarError] = useState<string>();
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const mounted = useRef(false); const generation = useRef(0); const mutating = useRef(false);
  const startMs = start.getTime(), endMs = end.getTime();
  const signature = entities.map(e => `${e.entity_id}:${e.last_updated}`).join('|');
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (mounted.current) setLoading(true);
    const read = async (kind: 'todo' | 'calendar') => {
      const source = kind === 'todo' ? todoSource : calendarSource;
      if (source === 'local') { if (mounted.current) (kind === 'todo' ? setTodoError : setCalendarError)(undefined); return; }
      try {
        if (connection !== 'connected') throw new Error('Home Assistant déconnecté · dernières données conservées.');
        const value = kind === 'todo' ? await getShopping(source) : await getEvents(source, new Date(startMs), new Date(endMs));
        if (!mounted.current || version !== generation.current) return;
        if (kind === 'todo') { setRemoteItems({ source, items: value as ShoppingItem[] }); setTodoError(undefined); }
        else { setRemoteEvents({ source, events: value as PlannerEvent[] }); setCalendarError(undefined); }
      } catch (error) { if (mounted.current && version === generation.current) (kind === 'todo' ? setTodoError : setCalendarError)(error instanceof Error ? error.message : 'Lecture impossible.'); }
    };
    await Promise.all([read('todo'), read('calendar')]);
    if (mounted.current && version === generation.current) setLoading(false);
  }, [todoSource, calendarSource, connection, startMs, endMs]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => { void refresh(); }, [refresh, signature]);
  useEffect(() => { const update = () => { if (document.visibilityState === 'visible') void refresh(); }; const id = window.setInterval(update, 60000); document.addEventListener('visibilitychange', update); return () => { clearInterval(id); document.removeEventListener('visibilitychange', update); }; }, [refresh]);
  const perform = async (kind: 'todo' | 'calendar', action: () => Promise<unknown> | void) => {
    if (mutating.current) return false;
    mutating.current = true; setBusy(true); (kind === 'todo' ? setTodoError : setCalendarError)(undefined);
    try { await action(); await refresh(); return true; }
    catch (error) { if (mounted.current) (kind === 'todo' ? setTodoError : setCalendarError)(error instanceof Error ? error.message : 'Enregistrement impossible.'); return false; }
    finally { mutating.current = false; if (mounted.current) setBusy(false); }
  };
  const items = todoSource === 'local' ? store.items : remoteItems?.source === todoSource ? remoteItems.items : [];
  const sourceEvents = calendarSource === 'local' ? store.events : remoteEvents?.source === calendarSource ? remoteEvents.events : [];
  const events = useMemo(() => sourceEvents.filter(e => overlaps(e, new Date(startMs), new Date(endMs))).sort((a, b) => eventTime(a.start) - eventTime(b.start)), [sourceEvents, startMs, endMs]);
  const todoEntity = todos.find(e => e.entity_id === todoSource); const calendarEntity = calendars.find(e => e.entity_id === calendarSource);
  const available = (entity: typeof todoEntity) => connection === 'connected' && !!entity && !['unavailable', 'unknown'].includes(entity.state);
  return { todos, calendars, todoSource, calendarSource, items, events, busy, loading, todoError, calendarError, refresh,
    canAdd: todoSource === 'local' || available(todoEntity) && (Number(todoEntity?.attributes.supported_features) & 1) !== 0,
    canCheck: todoSource === 'local' || available(todoEntity) && (Number(todoEntity?.attributes.supported_features) & 4) !== 0,
    canRemove: todoSource === 'local' || available(todoEntity) && (Number(todoEntity?.attributes.supported_features) & 2) !== 0,
    canCreate: calendarSource === 'local' || available(calendarEntity) && (Number(calendarEntity?.attributes.supported_features) & 1) !== 0,
    addItem: (text: string) => perform('todo', () => { const item = text.trim(); if (!item) throw new Error('Ajoute le nom d’un article.'); return todoSource === 'local' ? store.addItem(item) : plannerService('todo', 'add_item', todoSource, { item }); }),
    toggleItem: (item: ShoppingItem) => perform('todo', () => todoSource === 'local' ? store.toggleItem(item.uid) : plannerService('todo', 'update_item', todoSource, { item: item.uid, status: item.status === 'completed' ? 'needs_action' : 'completed' })),
    removeItem: (item: ShoppingItem) => perform('todo', () => todoSource === 'local' ? store.removeItem(item.uid) : plannerService('todo', 'remove_item', todoSource, { item: item.uid })),
    createEvent: (event: PlannerEvent) => perform('calendar', () => { validateEvent(event.summary, event.start, event.end); return calendarSource === 'local' ? store.saveEvent(event) : plannerService('calendar', 'create_event', calendarSource, { summary: event.summary.trim(), description: event.description, location: event.location, ...(event.allDay ? { start_date: event.start, end_date: event.end } : { start_date_time: new Date(event.start).toISOString(), end_date_time: new Date(event.end).toISOString() }) }); }),
    removeLocalEvent: (uid: string) => store.removeEvent(uid)
  };
}
