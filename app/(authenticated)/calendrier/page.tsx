"use client";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';

export default function CalendrierPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb: 2 }}>
        <Box sx={{ width:36, height:36, borderRadius:'50%', background:'#f2e8f4', color:'#894991', display:'grid', placeItems:'center' }}>
          <CalendarMonthRoundedIcon fontSize="small" />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#894991' }}>Calendrier</Typography>
      </Box>
      <Box sx={{
        mt: 2,
        p: 4,
        borderRadius: 2,
        border: '1px solid #eee',
        background: '#fff',
        textAlign: 'center'
      }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Page en construction</Typography>
        <Typography variant="body2" color="text.secondary">
          Cette section arrive bientôt. Merci pour votre patience.
        </Typography>
      </Box>
    </Box>
  );
}
