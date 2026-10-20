import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useClock } from '../../hooks/useClock';
import { dateKey } from '../../services/planner/client';
import { calendarMonth } from '../../services/planner/calendar';
import { usePlanner } from '../../hooks/usePlanner';
import { usePlannerStore } from '../../stores/plannerStore';
import { useAppStore } from '../../stores/appStore';
import { HomeCalendar } from './HomeCalendar';
import { ShoppingDrawer, type ClearRequest } from './ShoppingDrawer';

export function PlannerCards({ render }: { render?: (cards: { shopping: ReactNode; calendar: ReactNode }) => ReactNode } = {}) {
  const setPage = useAppStore(s => s.setPage);
  const setView = usePlannerStore(s => s.setView);
  const setSelectedDate = usePlannerStore(s => s.setSelectedDate);
  const clock = useClock();
  const today = dateKey(clock);
  const currentMonth = today.slice(0, 7);
  const [offset, setOffset] = useState(0);
  const [drawer, setDrawer] = useState<{ clear?: ClearRequest }>();
  const [draft, setDraft] = useState('');
  const month = useMemo(() => {
    const [year, number] = currentMonth.split('-').map(Number);
    return new Date(year, number - 1 + offset, 1);
  }, [currentMonth, offset]);
  const range = useMemo(() => calendarMonth(month), [month]);
  const planner = usePlanner(range.start, range.end);
  const pending = planner.items.filter(item => item.status !== 'completed');
  const openShopping = () => setDrawer({});
  const openCalendar = (date: Date) => { setSelectedDate(dateKey(date)); setView('calendar'); setPage('planner'); };

  const shopping = <article className="home-shopping" aria-label="Aperçu des courses">
      <div className="home-shopping-header"><button className="home-planner-heading" onClick={openShopping}><span><ListChecks size={18} />Courses<small>{pending.length}</small></span></button><button className="home-shopping-add" aria-label="Ajouter aux courses" title="Ajouter aux courses" disabled={!planner.canAdd || planner.busy} onClick={() => setDrawer({})}><Plus size={21} /></button><button className="home-shopping-clear" aria-label="Vider les courses" title="Vider la liste" disabled={!planner.items.length || !planner.canRemove || planner.busy} onClick={() => setDrawer({ clear: { source: planner.todoSource, ids: planner.items.map(item => item.uid) } })}><Trash2 size={17} /></button></div>
      {planner.todoError && <p className="planner-error" role="status">{planner.todoError}</p>}
      <div className="home-shopping-preview">{pending.map(item => <button key={item.uid} role="checkbox" aria-checked={false} aria-label={`Cocher ${item.summary}`} disabled={!planner.canCheck || planner.busy} onClick={() => void planner.toggleItem(item)}><i aria-hidden="true" /><span>{item.summary}</span></button>)}</div>
      {!pending.length && <p className="home-shopping-empty">{planner.loading ? 'Chargement…' : planner.todoError ? 'Liste indisponible' : 'Rien à acheter'}</p>}
    </article>;
  const calendar = <HomeCalendar month={month} days={range.days} weeks={range.weeks} today={today} events={planner.events} error={planner.calendarError} loading={planner.loading} onMonth={delta => setOffset(value => value + delta)} onToday={() => setOffset(0)} onOpen={openCalendar} />;
  return <>{render ? render({ shopping, calendar }) : <section className="home-planner">{shopping}{calendar}</section>}{drawer && <ShoppingDrawer planner={planner} draft={draft} onDraft={setDraft} initialClear={drawer.clear} onClose={() => setDrawer(undefined)} />}</>;
}
