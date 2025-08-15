"use client";
import { useEffect, useState, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, Snackbar, Alert, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const client = generateClient<Schema>();

type EditableSD = { id?: string; date: string; type: 'ferie'|'seminaire'|'conge_obligatoire'|'autre'; scope: 'global'|'user'; userId?: string|null };

export default function AdminSpecialDaysPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<EditableSD[]>([]);
  const [snackbar, setSnackbar] = useState<{open:boolean;message:string;severity:'success'|'error'|'info'}>({open:false,message:'',severity:'info'});
  const [newRow, setNewRow] = useState<EditableSD>({ date: '', type: 'ferie', scope:'global' });

  useEffect(() => {
    fetchAuthSession().then(sess => {
      const groups = sess.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
      setIsAdmin(groups?.includes('ADMINS') || false);
    }).catch(()=> setIsAdmin(false));
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await client.models.SpecialDay.list({});
      setRows((data||[]) as any);
    } catch { setSnackbar({open:true,message:'Erreur chargement',severity:'error'}); }
  }, [isAdmin]);

  useEffect(()=>{ if (isAdmin) load(); }, [isAdmin, load]);

  const broadcast = () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cra:special-days-updated')); };

  const add = async () => {
    if (!newRow.date) { setSnackbar({open:true,message:'Date requise',severity:'error'}); return; }
    try {
      const res = await client.models.SpecialDay.create(newRow as any);
      if (res.data) setRows(prev => [...prev, res.data as any]);
      setNewRow({ date:'', type:'ferie', scope:'global' });
      setSnackbar({open:true,message:'Jour spécial ajouté',severity:'success'});
      broadcast();
    } catch { setSnackbar({open:true,message:'Erreur ajout',severity:'error'}); }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    try {
      await client.models.SpecialDay.delete({ id });
      setRows(prev => prev.filter(r => r.id !== id));
      setSnackbar({open:true,message:'Supprimé',severity:'success'});
      broadcast();
    } catch { setSnackbar({open:true,message:'Erreur suppression',severity:'error'}); }
  };

  if (isAdmin === null) return <Box sx={{p:4}}>Chargement...</Box>;
  if (!isAdmin) return <Box sx={{p:4}}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{ p:4 }}>
      <Typography variant="h5" sx={{ fontWeight:600, color:'#894991', mb:2 }}>Administration - Jours spéciaux</Typography>

      <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', alignItems:'center', mb:2 }}>
        <TextField size="small" type="date" label="Date" InputLabelProps={{shrink:true}} value={newRow.date} onChange={e=>setNewRow(r=>({...r, date:e.target.value}))} />
        <Select size="small" value={newRow.type} onChange={e=>setNewRow(r=>({...r, type: e.target.value as any}))}>
          <MenuItem value="ferie">Férié</MenuItem>
          <MenuItem value="seminaire">Séminaire</MenuItem>
          <MenuItem value="conge_obligatoire">Congé obligatoire</MenuItem>
          <MenuItem value="autre">Autre</MenuItem>
        </Select>
        <Select size="small" value={newRow.scope} onChange={e=>setNewRow(r=>({...r, scope: e.target.value as any}))}>
          <MenuItem value="global">Global</MenuItem>
          <MenuItem value="user">Utilisateur</MenuItem>
        </Select>
        {newRow.scope === 'user' && (
          <TextField size="small" label="UserId" value={newRow.userId || ''} onChange={e=>setNewRow(r=>({...r, userId: e.target.value}))} />
        )}
        <Button variant="contained" startIcon={<AddIcon />} onClick={add} sx={{ background:'#894991', '&:hover':{ background:'#6a3a7a' } }}>Ajouter</Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Portée</TableCell>
            <TableCell>Utilisateur</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.type}</TableCell>
              <TableCell>{r.scope}</TableCell>
              <TableCell>{r.userId || '-'}</TableCell>
              <TableCell align="right">
                <Tooltip title="Supprimer"><span><IconButton size="small" color="error" onClick={()=>remove(r.id)}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {rows.length===0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py:3, color:'#777' }}>Aucun jour spécial</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={()=>setSnackbar(s=>({...s,open:false}))}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({...s,open:false}))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
