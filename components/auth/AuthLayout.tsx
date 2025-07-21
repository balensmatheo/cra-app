"use client";

import { Box, Typography } from '@mui/material';
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AuthLayout({ children, title }: AuthLayoutProps) {
  const formBoxSx = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    p: 4,
    maxWidth: 350,
    margin: '0 auto',
    background: 'var(--background, #fff)',
    borderRadius: 4,
    boxShadow: '0 4px 24px rgba(137,73,145,0.08)',
    alignItems: 'center',
  };

  const logoBlock = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, width: '100%' }}>
      <Image src="/logo/logo_sans_ecriture.png" alt="Logo" width={56} height={56} style={{ marginBottom: 8 }} />
      <Typography
        variant="h5"
        sx={{
          color: '#894991',
          fontWeight: 700,
          letterSpacing: 1,
          fontFamily: 'var(--font-geist-sans, Arial, Helvetica, sans-serif)',
          textAlign: 'center',
          width: '100%',
          wordBreak: 'break-word',
          lineHeight: 1.2,
          fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
          maxWidth: 260,
          mx: 'auto',
        }}
      >
        Compte rendu d'activité
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={formBoxSx}>
        {logoBlock}
        <Typography variant="h6" sx={{ color: '#894991', fontWeight: 600, mb: 1 }}>{title}</Typography>
        {children}
      </Box>
    </Box>
  );
}