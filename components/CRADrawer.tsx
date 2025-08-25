"use client";
import React from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Typography, Divider, Tooltip, Chip } from '@mui/material';
import { CheckCircle, HourglassEmpty, ReportProblem, HighlightOff, Lock } from '@mui/icons-material';

interface CRADrawerProps {
  open: boolean;
  onClose: () => void;
  submittedMonths: number[]; // kept for backwards compatibility (months non-draft)
  onMonthSelect: (monthIndex: number) => void;
  monthStatusMap?: Record<number,string>; // 1..12 -> status
  monthLockedMap?: Record<number, boolean>; // 1..12 -> MonthLock.locked
}

const months = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const CRADrawer: React.FC<CRADrawerProps> = ({ open, onClose, submittedMonths, onMonthSelect, monthStatusMap, monthLockedMap }) => {
  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentDay = currentDate.getDate();
  const warningThresholdDay = 24; // show warning only from the 24th

  const getStatus = (monthIndex: number) => {
    const monthNum = monthIndex + 1;
    const status = monthStatusMap?.[monthNum];
    const locked = monthLockedMap?.[monthNum];
    if (status === 'validated') return { icon: <CheckCircle color="success" fontSize="small" />, style: { color: '#2e7d32' } };
    // Use a lock icon to clearly represent closure by admin
    if (status === 'closed' || locked) return { icon: <Lock fontSize="small" sx={{ color: '#6d1b7b' }} />, style: { color: '#6d1b7b', fontWeight: 700 } };
  // Submitted by user, pending admin validation
  if (status === 'submitted') return { icon: <HourglassEmpty color="warning" fontSize="small" />, style: { color: '#ed6c02', fontWeight: 600 } };
    if (status === 'saved') return { icon: <CheckCircle color="primary" fontSize="small" />, style: { color: '#1976d2' } };
  // fallback & draft/saved-specific heuristics
    const isPastMonth = monthIndex < currentMonthIndex;
    const isCurrentMonth = monthIndex === currentMonthIndex;
  const isDraft = status === 'draft';
  const isSaved = status === 'saved';
    // Past months without a submitted/saved/validated CRA are errors (explicit draft or missing)
    if (isPastMonth && (isDraft || status === undefined)) {
      return { icon: <HighlightOff color="error" fontSize="small" />, style: { color: 'red' } };
    }
  // Current month: show late warning when status is draft or saved
  if (isCurrentMonth && (isDraft || isSaved) && currentDay >= warningThresholdDay) {
      return { icon: <ReportProblem color="warning" fontSize="small" />, style: {} };
    }
    // Neutral/default
    return { icon: <HourglassEmpty color="action" fontSize="small" />, style: {} };
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box
        sx={{ width: 300 }}
        role="presentation"
      >
        <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={600}>CRA de l'année</Typography>
        </Box>
        <Divider />
  <List>
          {months.map((month, index) => {
            const { icon, style } = getStatus(index);
            const status = monthStatusMap?.[index + 1];
            const isClosed = status === 'closed' || monthLockedMap?.[index + 1];
            const showLateWarningTooltip =
              (index === currentMonthIndex) &&
              (status === 'draft' || status === 'saved') &&
              (currentDay >= warningThresholdDay);
            const statusLabel = isClosed
              ? 'Clôturé'
              : status === 'validated'
              ? 'Validé'
              : status === 'submitted'
              ? 'Soumis'
              : (status === 'saved' || status === 'draft') && showLateWarningTooltip
              ? 'À soumettre'
              : status === 'saved'
              ? 'Enregistré'
              : undefined;
            return (
              <ListItem key={month} disablePadding>
                <Tooltip
                  title={
                    isClosed
                      ? 'Mois clôturé (édition bloquée)'
                      : showLateWarningTooltip
                      ? 'Merci de soumettre le CRA avant la fin du mois'
                      : ''
                  }
                  disableHoverListener={!(isClosed || showLateWarningTooltip)}
                  placement="right"
                >
                <ListItemButton
                  onClick={() => { onMonthSelect(index); onClose(); }}
                  sx={{
                    minHeight: 36,
                    px: 1.5,
                    ...(isClosed ? {
                      bgcolor: '#f3e6f8',
                      borderLeft: '3px solid #6d1b7b',
                      '&:hover': { bgcolor: '#ecd9f2' },
                    } : {}),
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, ...(isClosed ? { color: '#6d1b7b' } : {}) }}>{icon}</ListItemIcon>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                    <ListItemText
                      primary={month}
                      primaryTypographyProps={{ style, fontSize: 14 }}
                    />
                    {statusLabel && (
                      <Chip
                        label={statusLabel}
                        size="small"
            sx={{
                          ml: 'auto',
                          height: 22,
                          fontSize: 11,
                          ...(isClosed
                            ? { bgcolor: '#6d1b7b', color: 'white' }
                            : status === 'validated'
                            ? { bgcolor: '#2e7d32', color: 'white' }
              : showLateWarningTooltip
              ? { bgcolor: '#ed6c02', color: 'white' }
                            : status === 'submitted'
                            ? { bgcolor: '#ed6c02', color: 'white' }
                            : { bgcolor: '#1976d2', color: 'white' })
                        }}
                      />
                    )}
                  </Box>
                </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
};

export default CRADrawer;