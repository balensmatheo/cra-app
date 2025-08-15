"use client";
import { Box, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';

export default function AdminHomePage() {
  return (
    <Box sx={{ p: 4, display: 'grid', placeItems: 'center', minHeight: 300 }}>
      <Box sx={{ textAlign: 'center', color: '#894991' }}>
        <ConstructionIcon sx={{ fontSize: 56, mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Administration</Typography>
        <Typography variant="body1" sx={{ color: '#555' }}>Page en construction…</Typography>
      </Box>
    </Box>
  );
}
