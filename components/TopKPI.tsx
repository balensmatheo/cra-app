"use client";

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type TopKPIProps = {
  facturees: number; // total facturés (jours)
  businessDays: number; // jours ouvrés dans le mois
};

const StatCard: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({ label, value, color }) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 160,
      px: 2,
      py: 1.5,
      borderRadius: 2,
      border: '1px solid #e9ecef',
      background: '#ffffff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    }}
  >
    <Typography sx={{ fontSize: 12, textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: 0.6 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 24, fontWeight: 800, color: color || '#111827', lineHeight: 1.2 }}>
      {value}
    </Typography>
  </Box>
);

const TopKPI: React.FC<TopKPIProps> = ({ facturees, businessDays }) => {
  const rate = businessDays > 0 ? (facturees / businessDays) * 100 : 0;
  const rateColor = rate >= 80 ? '#16a34a' : rate >= 60 ? '#f59e0b' : '#dc2626';

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        alignItems: 'stretch',
        mb: 2,
      }}
    >
      <StatCard label="Facturés" value={facturees.toFixed(2)} color="#7c3aed" />
      <StatCard label="Jours ouvrés" value={businessDays} />
      <StatCard label="Taux" value={`${rate.toFixed(1)}%`} color={rateColor} />
    </Box>
  );
};

export default TopKPI;
