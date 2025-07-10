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
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      alignItems: { xs: 'stretch', md: 'center' },
      justifyContent: 'space-between',
      mb: 4,
      gap: 2
    }}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        alignItems: 'center'
      }}>
        <Typography variant="body1" sx={{
          fontWeight: 700,
          color: '#894991',
          fontSize: '1rem',
          letterSpacing: 0.5,
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          {userFamilyName && userGivenName
            ? `${userGivenName} ${userFamilyName}`
            : <Skeleton variant="text" width={160} height={32} sx={{ bgcolor: '#eee', borderRadius: 1 }} />
          }
        </Typography>
        <TextField
          label="Mois"
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          sx={{ width: { xs: '100%', sm: 180 } }}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        justifyContent: { xs: 'center', md: 'flex-end' },
        flexWrap: 'wrap'
      }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchCRA}
          size="small"
          sx={{
            borderColor: '#ff9800',
            color: '#ff9800',
            textTransform: 'none',
            '&:hover': { borderColor: '#f57c00', color: '#f57c00' }
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Recharger
          </Box>
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          size="small"
          sx={{
            backgroundColor: "#894991",
            textTransform: 'none',
            '&:hover': { backgroundColor: '#6a3a7a' }
          }}
          disabled={isLoadingCRA || !ownerId}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Sauvegarder
          </Box>
        </Button>
        <Button
          variant="outlined"
          startIcon={<DescriptionIcon />}
          onClick={handleExport}
          size="small"
          sx={{
            borderColor: '#4caf50',
            color: '#4caf50',
            textTransform: 'none',
            '&:hover': { borderColor: '#388e3c', color: '#388e3c' }
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Exporter
          </Box>
        </Button>
        <Button
          variant="outlined"
          startIcon={<FullscreenIcon />}
          onClick={toggleFullscreen}
          size="small"
          sx={{
            borderColor: '#ccc',
            color: '#666',
            textTransform: 'none',
            '&:hover': { borderColor: '#894991', color: '#894991' }
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Plein écran
          </Box>
        </Button>
      </Box>
    </Box>
  );
};

export default CRAHeader;