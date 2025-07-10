"use client";

import React from 'react';
import { Box, TextField, Button, Typography, Skeleton } from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import DescriptionIcon from '@mui/icons-material/Description';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

interface CRAHeaderProps {
  userFamilyName: string;
  userGivenName: string;
  selectedMonth: string;
  handleMonthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fetchCRA: () => void;
  handleSave: () => void;
  isLoadingCRA: boolean;
  ownerId: string | null;
  handleExport: () => void;
  toggleFullscreen: () => void;
}

const CRAHeader: React.FC<CRAHeaderProps> = ({
  userFamilyName,
  userGivenName,
  selectedMonth,
  handleMonthChange,
  fetchCRA,
  handleSave,
  isLoadingCRA,
  ownerId,
  handleExport,
  toggleFullscreen
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <Typography variant="body1" sx={{ minWidth: 200, fontWeight: 700, color: '#894991', fontSize: '1rem', letterSpacing: 0.5 }}>
          {userFamilyName && userGivenName
            ? `${userGivenName} ${userFamilyName} `
            : <Skeleton variant="text" width={160} height={32} sx={{ bgcolor: '#eee', borderRadius: 1, display: 'inline-block' }} />
          }
        </Typography>
        <TextField
          label="Mois"
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          sx={{ minWidth: 140 }}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon fontSize="small" />}
          onClick={fetchCRA}
          size="small"
          sx={{
            fontSize: 14,
            px: 2,
            py: 0.5,
            borderColor: '#ff9800',
            color: '#ff9800',
            textTransform: 'none',
            '&:hover': { borderColor: '#f57c00', color: '#f57c00' }
          }}
        >
          Recharger
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon fontSize="small" />}
          onClick={handleSave}
          size="small"
          sx={{
            fontSize: 14,
            px: 2,
            py: 0.5,
            backgroundColor: "#894991",
            textTransform: 'none',
            '&:hover': { backgroundColor: '#6a3a7a' }
          }}
          disabled={isLoadingCRA || !ownerId}
        >
          Sauvegarder
        </Button>
        <Button
          variant="outlined"
          startIcon={<DescriptionIcon fontSize="small" />}
          onClick={handleExport}
          size="small"
          sx={{
            fontSize: 14,
            px: 2,
            py: 0.5,
            borderColor: '#4caf50',
            color: '#4caf50',
            textTransform: 'none',
            '&:hover': { borderColor: '#388e3c', color: '#388e3c' }
          }}
        >
          Exporter
        </Button>
        <Button
            variant="outlined"
            startIcon={<FullscreenIcon fontSize="small" />}
            onClick={toggleFullscreen}
            size="small"
            sx={{
              fontSize: 14,
              px: 2,
              py: 0.5,
              borderColor: '#ccc',
              color: '#666',
              textTransform: 'none',
              '&:hover': { borderColor: '#894991', color: '#894991' }
            }}
          >
            Plein écran
          </Button>
      </Box>
    </Box>
  );
};

export default CRAHeader;