"use client";
import { CRAProvider } from '@/context/CRAContext';
import Navbar from '@/components/Navbar';
import Box from '@mui/material/Box';

export default function CongesLayout({ children }: { children: React.ReactNode }) {
  return (
    <CRAProvider>
      <Box sx={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Navbar />
        <Box sx={{ minHeight: 'calc(100vh - 72px)' }}>
          {children}
        </Box>
      </Box>
    </CRAProvider>
  );
}
