"use client";
import React from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Typography, Divider } from '@mui/material';
import { CheckCircle, HourglassEmpty, ReportProblem, HighlightOff } from '@mui/icons-material';

interface CRADrawerProps {
  open: boolean;
  onClose: () => void;
  submittedMonths: number[];
  onMonthSelect: (monthIndex: number) => void;
}

const months = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const CRADrawer: React.FC<CRADrawerProps> = ({ open, onClose, submittedMonths, onMonthSelect }) => {
  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  const getStatus = (monthIndex: number) => {
    const isSubmitted = submittedMonths.includes(monthIndex + 1);
    const isPastMonth = monthIndex < currentMonthIndex;

    if (isSubmitted) {
      return { icon: <CheckCircle color="success" fontSize="small" />, style: {} };
    }
    
    if (isPastMonth && !isSubmitted) {
      return { icon: <HighlightOff color="error" fontSize="small" />, style: { color: 'red' } };
    }

    if (monthIndex === currentMonthIndex && currentDay >= 20) {
        return { icon: <ReportProblem color="warning" fontSize="small" />, style: {} };
    }

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
            return (
              <ListItem key={month} disablePadding>
                <ListItemButton onClick={() => { onMonthSelect(index); onClose(); }} sx={{ minHeight: 36, px: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
                  <ListItemText primary={month} primaryTypographyProps={{ style, fontSize: 14 }} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
};

export default CRADrawer;