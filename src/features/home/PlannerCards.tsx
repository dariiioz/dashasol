import { CalendarDays, ChevronRight, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { useClock } from '../../hooks/useClock';
import { dateKey } from '../../services/planner/client';
import { usePlanner } from '../../hooks/usePlanner';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import { eventTime } from '../../services/planner/client';
import { EventList, ShoppingList } from '../planner/PlannerPage';
export function PlannerCards() {
  const setPage = useAppStore(s => s.setPage); const setView = usePlannerStore(s => s.setView);
  const open = (view: 'shopping' | 'calendar') => { setView(view); setPage('planner'); };
  const clock = useClock(); const today = dateKey(clock);
  const range = useMemo(() => { const start = new Date(today + 'T00:00:00'); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 30); return { start, end }; }, [today]);
  const planner = usePlanner(range.start, range.end); const now = Date.now(); const upcoming = planner.events.filter(event => eventTime(event.end) > now).slice(0, 4);
  return <section className="home-planner"><article className="home-shopping"><button className="home-planner-heading" onClick={() => open('shopping')}><span><ListChecks size={18} />Courses<small>{planner.items.filter(i => i.status !== 'completed').length}</small></span><ChevronRight size={17} /></button><ShoppingList planner={planner} compact /><small className="home-planner-source">{planner.todoSource === 'local' ? 'Sur cet appareil' : 'Home Assistant'}</small></article><article className="home-agenda"><button className="home-planner-heading" onClick={() => open('calendar')}><span><CalendarDays size={18} />À venir</span><ChevronRight size={17} /></button>{planner.calendarError && <p className="planner-error">{planner.calendarError}</p>}<div className="home-upcoming">{upcoming.map(event => <div key={event.uid}><span className="home-event-date">{new Date(eventTime(event.start)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><EventList events={[event]} /></div>)}{!upcoming.length && <p className="planner-empty">{planner.loading ? 'Chargement…' : planner.calendarError ? 'Agenda indisponible.' : 'Aucun événement dans les 30 prochains jours.'}</p>}</div><button className="planner-text-button" onClick={() => open('calendar')}>Ouvrir le calendrier →</button></article></section>;
}
