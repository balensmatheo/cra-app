"use client";
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Divider } from '@mui/material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarView from '@/components/CalendarView';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
// Page header is minimal; all calendar controls live inside CalendarView’s toolbar

type LeaveEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: { userId?: string; color?: string; type?: 'leave' | 'seminar' };
};

const client = generateClient<Schema>();

export default function CalendrierPage() {
  const [events, setEvents] = useState<LeaveEvent[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.idToken?.payload as any)?.['cognito:groups'] as string[] | undefined;
        setIsAdmin(!!groups?.includes('ADMINS'));
      } catch {}
      try {
        // 1) Fetch approved leaves (all authenticated users can see all leaves)
        const { data: leaves } = await client.models.LeaveRequest.list({ filter: { status: { eq: 'approuvee' as any } } });
        const leavesList = (leaves || []) as any[];

  // 2) Fetch all seminars invites (visible to all); we'll group them into a single seminar event
  const { data: seminars } = await (client.models.SeminarInvite.list as any)({});
        const seminarsList = (seminars || []) as any[];

        // 3) Fetch names from Cognito for titles
        let nameMap: Record<string, { given?: string; family?: string }> = {};
        try {
          const { data, errors } = await client.queries.listUsers({});
          if (!errors) {
            const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
            const users = (payload?.users || []) as any[];
            users.forEach(u => { nameMap[u.username] = { given: u.given_name, family: u.family_name }; });
          }
        } catch {}

        // 4) Build events: title "Congé - Prénom Nom" or "Séminaire - Prénom Nom" with deterministic color per user
        const toDate = (d: string) => new Date(d + 'T00:00:00');
        const addDays = (dt: Date, days: number) => {
          const copy = new Date(dt);
          copy.setDate(copy.getDate() + days);
          return copy;
        };
        const palette = ['#894991', '#1976d2', '#2e7d32', '#ed6c02', '#00897b', '#9c27b0', '#5e35b1', '#d81b60', '#3949ab', '#00796b', '#8e24aa', '#ef6c00', '#43a047', '#00acc1', '#6a3a7a'];
        const seminarPalette = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8', '#a29bfe', '#ffeaa7', '#fab1a0', '#74b9ff'];
        const hashString = (s: string) => {
          let h = 0;
          for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i), h |= 0;
          return Math.abs(h);
        };
        const colorForUser = (userId?: string, type: 'leave' | 'seminar' = 'leave') => {
          if (!userId) return '#894991';
          const colors = type === 'seminar' ? seminarPalette : palette;
          return colors[hashString(userId) % colors.length];
        };
        
        // Process leave events
        const leaveEvents: LeaveEvent[] = leavesList.map((lr) => {
          const sub = (lr as any).owner as string | undefined;
          const nm = sub ? nameMap[sub] : undefined;
          const fullName = nm ? [nm.given, nm.family].filter(Boolean).join(' ') : sub?.slice(0, 10) + '…';
          // react-big-calendar treats `end` as exclusive; add +1 day so the last day shows.
          return {
            id: lr.id,
            title: `Congé - ${fullName || 'Utilisateur'}`,
            start: toDate(lr.startDate),
            end: addDays(toDate(lr.endDate), 1),
            allDay: true,
            resource: { userId: sub, color: colorForUser(sub, 'leave'), type: 'leave' },
          };
        });

        // Process seminar events: group by (startDate,endDate,title,location) so only one line per seminar
        const groupedSeminars: Record<string, any[]> = {};
        for (const sem of seminarsList) {
          const key = [sem.startDate, sem.endDate, sem.title || '', sem.location || ''].join('|');
          (groupedSeminars[key] ||= []).push(sem);
        }
        const seminarEvents: LeaveEvent[] = Object.entries(groupedSeminars).map(([key, invs]) => {
          const s0: any = invs[0];
          const location = s0.location ? ` - ${s0.location}` : '';
          // Always show a neutral seminar label to avoid duplicate 'Séminaire' when the title already includes it
          const title = `Séminaire${location}`;
          return {
            id: `sem-${key}`,
            title,
            start: toDate(s0.startDate),
            end: addDays(toDate(s0.endDate), 1),
            allDay: true,
            // Use a deterministic color per seminar group
            resource: { type: 'seminar', color: colorForUser(key, 'seminar') },
          };
        });

  // Combine all events
  setEvents([...leaveEvents, ...seminarEvents]);
      } catch (e) {
        // noop; calendar will just be empty on error
      }
    })();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: '#f2e8f4', color: '#894991', display: 'grid', placeItems: 'center', border: '1px solid #ead9f0' }}>
          <CalendarMonthRoundedIcon fontSize="small" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#6a3a7a', letterSpacing: 0.2 }}>Calendrier</Typography>
      </Box>
      <CalendarView events={events} />
      {/* Liste consolidée des événements (une ligne par période) */}
      <Box sx={{ mt: 2.5, border: '1px solid #eee', borderRadius: 1.5, background: '#fff' }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, color: '#6a3a7a' }}>Événements</Typography>
          <Typography variant="body2" sx={{ color: '#667085' }}>{events.length} élément(s)</Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          {events.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#777' }}>Aucun événement</Typography>
          ) : (
            // Chaque événement est déjà une période (start..end exclusif). On affiche une entrée unique avec libellé de période.
            events
              .slice()
              .sort((a, b) => a.start.getTime() - b.start.getTime())
              .map((ev) => {
                // Calcul de la date de fin inclusive (car end est exclusif)
                const endInc = new Date(ev.end.getTime());
                endInc.setDate(endInc.getDate() - 1);
                const sameDay = ev.start.toDateString() === endInc.toDateString();
                const period = sameDay
                  ? format(ev.start, "dd MMM yyyy", { locale: fr })
                  : `${format(ev.start, 'dd MMM yyyy', { locale: fr })} → ${format(endInc, 'dd MMM yyyy', { locale: fr })}`;
                const color = ev.resource?.color || '#894991';
                return (
                  <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 1, border: '1px solid #eee', borderRadius: 1, mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                      <Box sx={{
                        width: 10,
                        height: 10,
                        borderRadius: ev.resource?.type === 'seminar' ? '2px' : '50%',
                        background: color,
                        boxShadow: `0 0 0 2px ${color}33`
                      }} />
                      <Typography sx={{ fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</Typography>
                    </Box>
                    <Typography sx={{ color: '#333', fontWeight: 500, whiteSpace: 'nowrap' }}>{period}</Typography>
                  </Box>
                );
              })
          )}
        </Box>
      </Box>
    </Box>
  );
}
