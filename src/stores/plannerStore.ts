import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export interface ShoppingItem { uid: string; summary: string; status: 'needs_action' | 'completed' }
export interface PlannerEvent { uid: string; summary: string; start: string; end: string; allDay: boolean; description?: string; location?: string }
interface PlannerStore {
  view: 'calendar' | 'shopping'; setView: (view: 'calendar' | 'shopping') => void;
  todoSource: string; calendarSource: string; items: ShoppingItem[]; events: PlannerEvent[];
  setTodoSource: (value: string) => void; setCalendarSource: (value: string) => void;
  addItem: (summary: string) => void; toggleItem: (uid: string) => void; removeItem: (uid: string) => void;
  saveEvent: (event: PlannerEvent) => void; removeEvent: (uid: string) => void;
}
export const usePlannerStore = create<PlannerStore>()(persist(set => ({
  view: 'calendar', setView: view => set({ view }),
  todoSource: '', calendarSource: '', items: [], events: [],
  setTodoSource: todoSource => set({ todoSource }), setCalendarSource: calendarSource => set({ calendarSource }),
  addItem: summary => set(s => ({ items: [...s.items, { uid: crypto.randomUUID(), summary, status: 'needs_action' }] })),
  toggleItem: uid => set(s => ({ items: s.items.map(item => item.uid === uid ? { ...item, status: item.status === 'completed' ? 'needs_action' : 'completed' } : item) })),
  removeItem: uid => set(s => ({ items: s.items.filter(item => item.uid !== uid) })),
  saveEvent: event => set(s => ({ events: [...s.events.filter(item => item.uid !== event.uid), event] })),
  removeEvent: uid => set(s => ({ events: s.events.filter(item => item.uid !== uid) }))
}), { name: 'domoryx-planner-v1' }));
