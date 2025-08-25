"use client";
import { CRAProvider } from '@/context/CRAContext';
import Navbar from '@/components/Navbar';
import Box from '@mui/material/Box';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale/fr';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CRAProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
        <Box sx={{ minHeight: '100vh', background: '#f5f5f5' }}>
          <Navbar />
          <Box sx={{ minHeight: 'calc(100vh - 72px)' }}>
            {children}
          </Box>
        </Box>
      </LocalizationProvider>
    </CRAProvider>
  );
}
