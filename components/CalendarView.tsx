"use client";
import { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

type LeaveEvent = {
  id: string;
  title: string; // e.g., "Congé - Prénom Nom"
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: { userId?: string; color?: string };
};

const locales = { fr } as any;
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

type ViewType = 'month' | 'week' | 'day';

interface CalendarViewProps {
  events?: LeaveEvent[];
  view?: ViewType;
  onViewChange?: (v: ViewType) => void;
  date?: Date;
  onDateChange?: (d: Date) => void;
  height?: number | string;
  loading?: boolean;
  eventColor?: (e: LeaveEvent) => string | undefined;
  onSelectEvent?: (e: LeaveEvent) => void;
}

export default function CalendarView({ events = [], view: controlledView, onViewChange, date: controlledDate, onDateChange, height = 650, loading = false, eventColor, onSelectEvent }: CalendarViewProps) {
  const [innerView, setInnerView] = useState<ViewType>('month');
  const [innerDate, setInnerDate] = useState<Date>(new Date());
  const view = controlledView ?? innerView;
  const date = controlledDate ?? innerDate;

  const styledEvents = useMemo(() => events, [events]);

  const formats = useMemo(() => ({
    dayFormat: 'EEE dd',
    weekdayFormat: 'EEE',
    dayHeaderFormat: "EEEE dd MMMM",
    agendaHeaderFormat: ({ start, end }: any) => `${format(start, 'dd MMM', { locale: fr })} – ${format(end, 'dd MMM yyyy', { locale: fr })}`,
  }), []);

  const EventPill = ({ event, title }: any) => {
    const color = (eventColor && eventColor(event)) || event?.resource?.color || '#894991';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#fff', boxShadow: `0 0 0 2px ${color}` }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </div>
    );
  };

  const Toolbar = (tb: any) => {
    const { label, onNavigate, view: curView, onView, views } = tb;
    const can = (v: string) => Array.isArray(views) && views.includes(v);
    const btn = (children: any, onClick: () => void, secondary = false) => (
      <button
        onClick={onClick}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #e7dff0',
          background: secondary ? '#fff' : 'linear-gradient(180deg, #faf5fc 0%, #f3e8f6 100%)',
          color: '#6a3a7a',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {children}
      </button>
    );
    const toggle = (v: string, label: string) => (
      <button
        onClick={() => onView(v)}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid ' + (curView === v ? '#894991' : '#e7dff0'),
          background: curView === v ? '#894991' : '#fff',
          color: curView === v ? '#fff' : '#3b1f46',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        {label}
      </button>
    );
    return (
      <div style={{
        marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', padding: 10,
        borderRadius: 12, background: 'linear-gradient(180deg, #fbf7fc 0%, #f4ecf7 100%)', border: '1px solid #ecdef3'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {btn('Aujourd\'hui', () => onNavigate('TODAY'), true)}
          {btn('Précédent', () => onNavigate('PREV'), true)}
          <div style={{ fontWeight: 800, color: '#3b1f46', minWidth: 180, textAlign: 'center', textTransform: 'capitalize' }}>{label}</div>
          {btn('Suivant', () => onNavigate('NEXT'), true)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {can('month') && toggle('month', 'Mois')}
          {can('week') && toggle('week', 'Semaine')}
          {can('day') && toggle('day', 'Jour')}
        </div>
      </div>
    );
  };

  return (
  <div style={{ height, background: '#fff', borderRadius: 8, border: '1px solid #eee', position: 'relative' }}>
      <Calendar
        culture="fr"
        localizer={localizer}
        events={styledEvents}
        startAccessor="start"
        endAccessor="end"
  style={{ height: '100%' }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        view={view}
        onView={(v: any) => { if (onViewChange) onViewChange(v); else setInnerView(v); }}
        date={date}
        onNavigate={(d: Date) => { if (onDateChange) onDateChange(d); else setInnerDate(d); }}
        popup
        formats={formats as any}
        components={{
          event: EventPill as any,
          toolbar: Toolbar as any,
        }}
        onSelectEvent={onSelectEvent as any}
        messages={{
          month: 'Mois', week: 'Semaine', day: 'Jour', today: "Aujourd'hui", previous: 'Précédent', next: 'Suivant',
          showMore: (total: number) => `+${total} de plus`,
        }}
  dayPropGetter={(date: Date) => {
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isToday = new Date().toDateString() === date.toDateString();
          const style: React.CSSProperties = {};
          if (isWeekend) {
            style.backgroundColor = '#fafafa';
          }
          if (isToday) {
            style.boxShadow = 'inset 0 0 0 2px #89499122';
          }
          return { style } as any;
        }}
        eventPropGetter={(event: any) => {
          const color = (eventColor && eventColor(event)) || event.resource?.color || '#894991';
          return {
            style: {
              backgroundColor: color,
              borderColor: color,
              color: '#fff',
              borderRadius: 6,
            },
          };
    }}
      />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.65)', display: 'grid', placeItems: 'center', borderRadius: 8 }}>
          <div style={{ padding: 10, borderRadius: 999, border: '1px solid #eee', background: '#fff', color: '#6a3a7a', fontWeight: 600 }}>
            Chargement…
          </div>
        </div>
      )}
      <style jsx global>{`
        .rbc-calendar {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .rbc-header {
          background: linear-gradient(180deg, #fbf7fc 0%, #f4ecf7 100%);
          border-bottom: 1px solid #ecdef3;
          color: #6a3a7a;
          font-weight: 700;
        }
        .rbc-off-range-bg { background: #faf7fb; }
        .rbc-today { background: #fdf8ff; }
        .rbc-month-row, .rbc-time-view, .rbc-agenda-view {
          border-color: #f0e6f4;
        }
        .rbc-event {
          box-shadow: 0 2px 6px rgba(137,73,145,.15);
        }
        .rbc-selected-cell { background: #f3e8f6; }
        .rbc-show-more { color: #894991; font-weight: 700; }
      `}</style>
    </div>
  );
}
