"use client";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarView from '@/components/CalendarView';

export default function CalendrierPage() {
  // Placeholder events (squelette) to preview calendar rendering
  const today = new Date();
  const sampleEvents = [
    {
      id: '1',
      title: 'Congé - Alice Dupont',
      start: new Date(today.getFullYear(), today.getMonth(), 5),
      end: new Date(today.getFullYear(), today.getMonth(), 7),
      resource: { userId: 'u1', color: '#894991' },
    },
    {
      id: '2',
      title: 'RTT - Bob Martin',
      start: new Date(today.getFullYear(), today.getMonth(), 12),
      end: new Date(today.getFullYear(), today.getMonth(), 12),
      resource: { userId: 'u2', color: '#2e7d32' },
    },
    {
      id: '3',
      title: 'Congé - Clara Morel',
      start: new Date(today.getFullYear(), today.getMonth(), 18),
      end: new Date(today.getFullYear(), today.getMonth(), 22),
      resource: { userId: 'u3', color: '#0277bd' },
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb: 2 }}>
        <Box sx={{ width:36, height:36, borderRadius:'50%', background:'#f2e8f4', color:'#894991', display:'grid', placeItems:'center' }}>
          <CalendarMonthRoundedIcon fontSize="small" />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#894991' }}>Calendrier</Typography>
      </Box>
      <CalendarView events={sampleEvents} />
    </Box>
  );
}
