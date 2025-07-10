"use client";

import React from 'react';
import { Box, Typography } from "@mui/material";

interface CRASummaryProps {
  totalDays: number;
  businessDaysInMonth: number;
  saved: boolean;
  error: string;
}

const CRASummary: React.FC<CRASummaryProps> = ({
  totalDays,
  businessDaysInMonth,
  saved,
  error
}) => {
  return (
    <>
      <Box sx={{
        width: '100%',
        maxWidth: 1700,
        mx: 'auto',
        mt: 4,
        mb: 2,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 2
      }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backgroundColor: '#f8f9fa',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          minWidth: 'fit-content'
        }}>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '60px'
          }}>
            <Typography sx={{
              fontSize: '0.75rem',
              color: '#6c757d',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Facturés
            </Typography>
            <Typography sx={{
              fontSize: '1.5rem',
              color: '#894991',
              fontWeight: 700,
              lineHeight: 1
            }}>
              {totalDays.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            color: '#6c757d',
            fontSize: '1.2rem',
            fontWeight: 300
          }}>
            /
          </Box>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '60px'
          }}>
            <Typography sx={{
              fontSize: '0.75rem',
              color: '#6c757d',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Jours Ouvrés
            </Typography>
            <Typography sx={{
              fontSize: '1.5rem',
              color: '#495057',
              fontWeight: 700,
              lineHeight: 1
            }}>
              {businessDaysInMonth}
            </Typography>
          </Box>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginLeft: '12px',
            paddingLeft: '12px',
            borderLeft: '1px solid #dee2e6'
          }}>
            <Typography sx={{
              fontSize: '0.75rem',
              color: '#6c757d',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Taux
            </Typography>
            <Typography sx={{
              fontSize: '1.2rem',
              color: totalDays / businessDaysInMonth >= 0.8 ? '#28a745' : totalDays / businessDaysInMonth >= 0.6 ? '#ffc107' : '#dc3545',
              fontWeight: 700,
              lineHeight: 1
            }}>
              {((totalDays / businessDaysInMonth) * 100).toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      </Box>
      {error && <Typography sx={{ color: "red", mt: 2, fontWeight: 500 }}>{error}</Typography>}
    </>
  );
};

export default CRASummary;