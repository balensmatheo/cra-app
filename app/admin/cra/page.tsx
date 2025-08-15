"use client";

import { useEffect, useState, useMemo } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Button, Chip, Table, TableHead, TableRow, TableCell, TableBody, Snackbar, Alert, CircularProgress } from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';

const client = generateClient<Schema>();

interface CraRow {
  id: string;
  owner: string | null | undefined;
  month: string;
  status: string;
  entriesCount: number;
}

export default function AdminCraPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [craList, setCraList] = useState<CraRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{open:boolean; message:string; severity:'success'|'error'|'info' }>({open:false,message:'',severity:'info'});
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        if (groups && groups.includes('ADMINS')) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const loadCras = async () => {
    setLoading(true);
    try {
      const prefix = `${year}-`;
      const { data } = await client.models.Cra.list({ filter: { month: { beginsWith: prefix } } });
      const rows: CraRow[] = (data || []).map(c => ({
        id: c.id,
        owner: (c as any).owner,
        month: c.month || '',
        status: (c as any).status || 'draft',
        entriesCount: (c as any).entries?.length || 0
      }));
      setCraList(rows.sort((a,b) => a.month.localeCompare(b.month)));
    } catch (e:any) {
      setSnackbar({open:true,message:'Erreur chargement CRA',severity:'error'});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) loadCras(); }, [isAdmin, year]);

  const closeCra = async (id: string) => {
    try {
      const { data } = await client.models.Cra.get({ id });
      if (!data) throw new Error('CRA introuvable');
      if ((data as any).status !== 'validated') {
        setSnackbar({open:true,message:'Le CRA doit être validé avant clôture',severity:'error'});
        return;
      }
      await client.models.Cra.update({ id: data.id, status: 'closed' as any });
      setSnackbar({open:true,message:'CRA clôturé',severity:'success'});
      loadCras();
    } catch (e:any) {
      setSnackbar({open:true,message:'Echec clôture',severity:'error'});
    }
  };

  if (isAdmin === null) {
    return <Box sx={{p:4, display:'flex', justifyContent:'center'}}><CircularProgress /></Box>;
  }
  if (isAdmin === false) {
    return <Box sx={{p:4}}><Typography variant="h6" color="error">Accès refusé</Typography></Box>;
  }

  const statusColor = (s: string): ChipProps['color'] => {
    switch (s) {
      case 'draft': return 'default';
      case 'saved': return 'info';
      case 'validated': return 'success';
      case 'closed': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Box sx={{p:4}}>
      <Typography variant="h5" sx={{mb:3, fontWeight:600, color:'#894991'}}>Administration CRA - Clôture</Typography>
      <Box sx={{display:'flex', gap:2, mb:2, alignItems:'center'}}>
        <FormControl size="small">
          <InputLabel>Année</InputLabel>
          <Select label="Année" value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={loadCras} disabled={loading}>Actualiser</Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Mois</TableCell>
            <TableCell>Propriétaire</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell align="right">Entrées</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {craList.map(row => (
            <TableRow key={row.id} hover>
              <TableCell>{row.month}</TableCell>
              <TableCell>{row.owner?.slice(0,8)}…</TableCell>
              <TableCell>
                <Chip size="small" label={row.status} color={statusColor(row.status)} />
              </TableCell>
              <TableCell align="right">{row.entriesCount}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  onClick={() => closeCra(row.id)}
                  disabled={row.status !== 'validated'}
                >Clôturer</Button>
              </TableCell>
            </TableRow>
          ))}
          {craList.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{py:4, color:'#777'}}>Aucun CRA trouvé</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {loading && <Box sx={{textAlign:'center', py:3}}><CircularProgress size={28} /></Box>}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({...s, open:false}))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({...s, open:false}))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
