"use client";

import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Skeleton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, IconButton } from "@mui/material";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveIcon from '@mui/icons-material/Save';
import DescriptionIcon from '@mui/icons-material/Description';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import EditIcon from '@mui/icons-material/Edit';

interface CRAHeaderProps {
  userFamilyName: string;
  userGivenName: string;
  selectedMonth: string;
  handleMonthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSave: () => void;
  handleSubmit?: () => void; // soumission finale
  isLoadingCRA: boolean;
  ownerId: string | null;
  handleExport: () => void;
  toggleFullscreen: () => void;
  statusBadge?: { status: string; validationDisabledReason?: string; readOnly?: boolean; editingOther?: boolean };
  validationState?: { ok: boolean; errors: string[] }; // (désactivé visuellement pour brouillon)
  lastSavedAt?: Date | null;
  onResetAll?: () => void;
  dirty?: boolean;
  disableSubmit?: boolean;
  disableSubmitReason?: string;
  onCloseCra?: () => void; // bouton clôture admin
  canClose?: boolean;
  saving?: boolean;
  submitting?: boolean;
  exporting?: boolean;
  closing?: boolean;
  reopening?: boolean;
  onReopen?: () => void;
}

const CRAHeader: React.FC<CRAHeaderProps> = ({
  userFamilyName,
  userGivenName,
  selectedMonth,
  handleMonthChange,
  handleSave,
  handleSubmit,
  isLoadingCRA,
  ownerId,
  handleExport,
  toggleFullscreen,
  statusBadge,
  validationState,
  lastSavedAt,
  onResetAll,
  dirty
  , disableSubmit
  , disableSubmitReason
  , onCloseCra
  , canClose
  , saving
  , submitting
  , exporting
  , closing
  , reopening
  , onReopen
}) => {
  const [whyOpen, setWhyOpen] = useState(false);
  const status = statusBadge?.status;
  const readOnly = statusBadge?.readOnly;
  const editingOther = statusBadge?.editingOther;
  const statusColorMap: Record<string, string> = {
    draft: '#9e9e9e',
    saved: '#1976d2',
    validated: '#2e7d32',
    closed: '#6d1b7b'
  };
  const statusLabelMap: Record<string, string> = {
    draft: 'Brouillon',
    saved: 'Enregistré',
    validated: 'Validé',
    closed: 'Clôturé'
  };
  const [lastSavedLabel, setLastSavedLabel] = useState<string>("");
  useEffect(() => {
    if (lastSavedAt) {
      const d = lastSavedAt instanceof Date ? lastSavedAt : new Date(lastSavedAt);
      setLastSavedLabel(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } else {
      setLastSavedLabel("");
    }
  }, [lastSavedAt]);
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      alignItems: { xs: 'stretch', md: 'center' },
      justifyContent: 'space-between',
      mb: 2,
      gap: 1.5,
      p: 1.5,
      borderRadius: 2,
  background: '#faf8fc',
  border: '1px solid #efe7f3'
    }}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        alignItems: 'center'
      }}>
        <Typography variant="body1" sx={{
          fontWeight: 800,
          color: '#6a3a7a',
          fontSize: '1.05rem',
          letterSpacing: 0.3,
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          {userFamilyName && userGivenName
            ? `${userGivenName} ${userFamilyName}`
            : <Skeleton variant="text" width={160} height={32} sx={{ bgcolor: '#eee', borderRadius: 1 }} />
          }
        </Typography>
        {(() => {
          // Hydration guard: render stable placeholder on server, real input only after mount
          const [mounted, setMounted] = useState(false);
          useEffect(() => { setMounted(true); }, []);
          if (!mounted) {
            return (
              <Box sx={{ width: { xs: '100%', sm: 180 }, height: 40 }} aria-hidden suppressHydrationWarning>
                <Skeleton variant="rounded" width="100%" height={40} />
              </Box>
            );
          }
          return (
            <Box suppressHydrationWarning>
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
          );
        })()}
        {status && (
            <Box sx={{
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            border: `1px solid ${statusColorMap[status] ?? '#9e9e9e'}`,
              backgroundColor: `${(statusColorMap[status] ?? '#9e9e9e')}14`,
              color: statusColorMap[status] ?? '#424242',
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.3
          }}>
            {statusLabelMap[status] ?? status}
          </Box>
        )}
        {readOnly && (
            <Box sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
              backgroundColor: '#eeeeee',
              border: '1px solid #cccccc',
            fontSize: '0.7rem',
            fontWeight: 600,
              color: '#555',
            textTransform: 'uppercase'
          }}>
            Lecture seule
          </Box>
        )}
        {!readOnly && editingOther && (
            <Box sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
              backgroundColor: '#f4e9f6',
              border: '1px solid #e7dff0',
            fontSize: '0.7rem',
            fontWeight: 700,
              color: '#6a3a7a',
            textTransform: 'uppercase'
          }}>
            Édition d’un autre utilisateur
          </Box>
        )}
      </Box>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        justifyContent: { xs: 'center', md: 'flex-end' },
        flexWrap: 'wrap'
      }}>
  {/* Badge validation retiré (affiché seulement lors de la soumission finale) */}
        {lastSavedLabel && (
            <Box sx={{
            fontSize: '0.6rem',
              color: '#666',
            px: 1,
            py: 0.5,
            borderRadius: 1,
              background: '#f5f5f5',
              border: '1px solid #e0e0e0'
          }}>
            Sauvé à {lastSavedLabel}
          </Box>
        )}
        {canClose && status !== 'validated' && (
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            onClick={onCloseCra}
            sx={{ textTransform:'none', borderColor:'#6d1b7b', color:'#6d1b7b', '&:hover':{ borderColor:'#4a1352', color:'#4a1352' } }}
          >Clôturer</Button>
        )}
  {status !== 'validated' && (
  <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          size="small"
          sx={{
            backgroundColor: "#894991",
            textTransform: 'none',
            '&:hover': { backgroundColor: '#6a3a7a' }
          }}
          disabled={saving || isLoadingCRA || !ownerId || readOnly}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Box>
        </Button>
  )}
    {status !== 'validated' && status !== 'closed' && !readOnly && (
          <Tooltip title={disableSubmit ? (disableSubmitReason || 'Complétez les informations manquantes avant de soumettre.') : ''} disableInteractive arrow placement="top">
          <span>
          <Button
            variant="outlined"
            color="success"
            onClick={handleSubmit}
            size="small"
            sx={{
              borderColor: '#2e7d32',
              color: '#2e7d32',
              textTransform: 'none',
              '&:hover': { borderColor: '#1b5e20', color: '#1b5e20' }
            }}
      disabled={!!disableSubmit || submitting}
          >
            {submitting && <CircularProgress size={16} sx={{ mr: 1 }} />}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Soumettre
            </Box>
          </Button>
          </span>
          </Tooltip>
        )}
        {status !== 'validated' && status !== 'closed' && !readOnly && !!disableSubmit && !submitting && (
          <Tooltip title="Voir les détails manquants" arrow>
            <IconButton
              size="small"
              onClick={() => setWhyOpen(true)}
              sx={{ ml: 0.5, width: 28, height: 28, border: '1px solid #e0e0e0' }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
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
          disabled={exporting}
        >
          {exporting && <CircularProgress size={16} sx={{ mr: 1 }} />}
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
  {status === 'validated' && !!onReopen && (
          <Button
            variant="outlined"
            startIcon={reopening ? <CircularProgress size={16} /> : <EditIcon />}
            onClick={onReopen}
            size="small"
            sx={{
              borderColor: '#6a3a7a',
              color: '#6a3a7a',
              textTransform: 'none',
              '&:hover': { borderColor: '#4a2a57', color: '#4a2a57' }
            }}
            disabled={reopening}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Modifier
            </Box>
          </Button>
        )}
      </Box>
      <Dialog open={whyOpen} onClose={() => setWhyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pourquoi le bouton Soumettre est désactivé ?</DialogTitle>
        <DialogContent dividers>
          {dirty && (
            <Typography variant="body2" sx={{ mb: 1 }} color="warning.main">
              Enregistrez d'abord vos modifications.
            </Typography>
          )}
          {!!validationState && !validationState.ok && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Erreurs à corriger:</Typography>
              <ul style={{ paddingLeft: 18, marginTop: 0 }}>
                {validationState.errors.map((e, i) => (
                  <li key={i}><Typography variant="body2">{e}</Typography></li>
                ))}
              </ul>
            </Box>
          )}
          {!!validationState?.ok && !dirty && (
            <Typography variant="body2">Aucune erreur détectée.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setWhyOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CRAHeader;