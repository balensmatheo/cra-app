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

interface CalendarViewProps {
  events?: LeaveEvent[];
}

export default function CalendarView({ events = [] }: CalendarViewProps) {
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());

  const styledEvents = useMemo(() => events, [events]);

  return (
    <div style={{ height: 650, background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
      <Calendar
        culture="fr"
        localizer={localizer}
        events={styledEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        popup
        messages={{
          month: 'Mois', week: 'Semaine', day: 'Jour', today: "Aujourd'hui", previous: 'Précédent', next: 'Suivant',
          showMore: (total: number) => `+${total} de plus`,
        }}
  eventPropGetter={(event: any) => {
          const color = event.resource?.color || '#894991';
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
    </div>
  );
}
