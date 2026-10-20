import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKey, eventLabel, eventTime, overlaps } from '../../services/planner/client';
import type { PlannerEvent } from '../../stores/plannerStore';

interface Props {
  month: Date;
  days: Date[];
  weeks: number;
  today: string;
  events: PlannerEvent[];
  error?: string;
  loading: boolean;
  onMonth: (offset: number) => void;
  onToday: () => void;
  onOpen: (date: Date) => void;
}

export function HomeCalendar({ month, days, weeks, today, events, error, loading, onMonth, onToday, onOpen }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const [eventLimit, setEventLimit] = useState(2);
  const [compactCells, setCompactCells] = useState(false);
  useEffect(() => {
    if (!grid.current || typeof ResizeObserver === 'undefined') return;
    const element = grid.current;
    const update = () => {
      const height = element.clientHeight / weeks;
      setEventLimit(height >= 140 ? 3 : height >= 100 ? 2 : 1);
      setCompactCells(height < 78);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [weeks]);

  return <article className="home-agenda home-calendar" aria-label="Calendrier du mois">
    <header className="home-calendar-header">
      <button className="home-calendar-title" aria-label="Ouvrir le calendrier" onClick={() => onOpen(month)}><CalendarDays size={18} /><span aria-live="polite">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span></button>
      <div className="home-calendar-actions"><button className="home-calendar-today" onClick={onToday}>Aujourd’hui</button><button aria-label="Mois précédent" onClick={() => onMonth(-1)}><ChevronLeft size={19} /></button><button aria-label="Mois suivant" onClick={() => onMonth(1)}><ChevronRight size={19} /></button></div>
    </header>
    {error && <p className="planner-error" role="status">{error}</p>}
    {loading && <span className="home-calendar-loading" role="status">Actualisation…</span>}
    <div className="home-calendar-weekdays" aria-hidden="true">{['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'].map(label => <span key={label}>{label}</span>)}</div>
    <div className="home-calendar-grid" ref={grid} data-event-limit={eventLimit} data-compact-cells={compactCells} style={{ '--calendar-weeks': weeks } as CSSProperties}>
      {days.map(date => {
        const key = dateKey(date);
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        const scheduled = events.filter(event => overlaps(event, date, end));
        const remaining = Math.max(0, scheduled.length - eventLimit);
        return <button className="home-calendar-day" key={key} data-other-month={date.getMonth() !== month.getMonth()} aria-current={key === today ? 'date' : undefined} aria-label={`${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${scheduled.length} événement${scheduled.length > 1 ? 's' : ''}`} onClick={() => onOpen(date)}>
          <span className="home-calendar-date"><span>{date.getDate()}</span>{remaining > 0 && <small aria-label={`${remaining} autre${remaining > 1 ? 's' : ''} événement${remaining > 1 ? 's' : ''}`}>+{remaining}</small>}</span>
          <span className="home-calendar-entries">{scheduled.slice(0, eventLimit).map(event => <span className="home-calendar-event" data-all-day={event.allDay} key={event.uid} title={`${eventLabel(event)} · ${event.summary}`}>
            {!event.allDay && dateKey(new Date(eventTime(event.start))) === key && <time>{eventLabel(event)}</time>}<span>{event.summary}</span>
          </span>)}</span>
        </button>;
      })}
    </div>
  </article>;
}
