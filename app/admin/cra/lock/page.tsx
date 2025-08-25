"use client";

import { useEffect, useMemo, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Table, TableHead, TableRow, TableCell, TableBody, Button, Chip, Snackbar, Alert, Skeleton } from '@mui/material';
import { useCRA } from '@/context/CRAContext';

const client = generateClient<Schema>();

type MonthRow = { month: string; locked: boolean; lockId?: string };

export default function AdminMonthLockPage() {
  const { updateMonthLockedLocal } = useCRA();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success'|'error'|'info' }>({ open:false, message:'', severity:'info' });

  const years = useMemo(() => {
    const curr = new Date().getFullYear();
    return [curr - 1, curr, curr + 1];
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        setIsAdmin(!!groups?.includes('ADMINS'));
      } catch { setIsAdmin(false); }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Build all months of selected year
      const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
      // Fetch existing locks for the year
      const prefix = `${year}-`;
      const { data } = await client.models.MonthLock.list({ filter: { month: { beginsWith: prefix } } });
      const lockMap = new Map<string, { id: string; locked: boolean }>();
      (data || []).forEach((m: any) => lockMap.set(m.month, { id: m.id, locked: !!m.locked }));
      const rows: MonthRow[] = months.map(m => ({ month: m, locked: lockMap.get(m)?.locked || false, lockId: lockMap.get(m)?.id }));
      setRows(rows);
    } catch {
      setRows([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, year]);

  const toggleLock = async (row: MonthRow) => {
    try {
      if (row.lockId) {
        // Update existing lock
        await client.models.MonthLock.update({ id: row.lockId, locked: !row.locked });
      } else if (!row.locked) {
        // Create lock if toggling from unlocked -> locked
        await client.models.MonthLock.create({ month: row.month as any, locked: true as any });
      } else {
        // Row says locked but no id (inconsistent), try creating unlocked state by ensuring no record or update after reload
        await client.models.MonthLock.create({ month: row.month as any, locked: false as any });
      }
      setSnackbar({ open: true, message: (!row.locked ? 'Mois verrouillé' : 'Mois déverrouillé'), severity: 'success' });
  updateMonthLockedLocal(row.month, !row.locked);
  setRows(prev => prev.map(r => r.month === row.month ? { ...r, locked: !row.locked } : r));
    } catch {
      setSnackbar({ open: true, message: 'Action impossible', severity: 'error' });
    }
  };

  if (isAdmin === null) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={260} height={36} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2, maxWidth: 420 }} />
        <Skeleton variant="rectangular" height={320} />
      </Box>
    );
  }
  if (!isAdmin) {
    return <Box sx={{ p: 4 }}><Typography color="error">Accès refusé</Typography></Box>;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: '#894991' }}>Clôture mensuelle — Blocage/Déblocage</Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
        <FormControl size="small">
          <InputLabel>Année</InputLabel>
          <Select label="Année" value={year} onChange={(e)=>setYear(Number(e.target.value))}>
            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={load} disabled={loading}>Actualiser</Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Mois</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.month} hover>
              <TableCell>{r.month}</TableCell>
              <TableCell>
                <Chip size="small" label={r.locked ? 'Bloqué' : 'Ouvert'} color={r.locked ? 'secondary' : 'success'} />
              </TableCell>
              <TableCell align="right">
                <Button size="small" variant="contained" color={r.locked ? 'success' : 'secondary'} onClick={() => toggleLock(r)}>
                  {r.locked ? 'Débloquer' : 'Bloquer'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={()=>setSnackbar(s=>({ ...s, open:false }))}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({ ...s, open:false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
