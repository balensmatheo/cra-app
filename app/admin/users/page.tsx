"use client";
import { useEffect, useState, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Switch, Snackbar, Alert, IconButton, Tooltip, TextField } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const client = generateClient<Schema>();

interface EditableUser { id: string; displayName: string; email: string; groups: string[]; active?: boolean; dirty?: boolean; }

export default function AdminUsersPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<EditableUser[]>([]);
  const [snackbar, setSnackbar] = useState<{open:boolean; message:string; severity:'success'|'error'|'info'}>({open:false,message:'',severity:'info'});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAuthSession().then(sess => {
      const groups = sess.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
      setIsAdmin(groups?.includes('ADMINS') || false);
    }).catch(()=> setIsAdmin(false));
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data } = await client.models.UserProfile.list({});
      setRows((data||[]).map(u => ({ id: u.id, displayName: (u as any).displayName || '', email: (u as any).email || '', groups: (u as any).groups || [], active: (u as any).active !== false })));
    } catch { setSnackbar({open:true,message:'Erreur chargement',severity:'error'}); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(()=>{ if (isAdmin) load(); }, [isAdmin, load]);

  const toggleActive = async (user: EditableUser) => {
    try {
      await client.models.UserProfile.update({ id: user.id, active: !user.active, updatedBy: 'admin' });
      setRows(prev => prev.map(r => r.id === user.id ? { ...r, active: !r.active } : r));
      setSnackbar({ open:true, message:'Statut mis à jour', severity:'success' });
    } catch { setSnackbar({ open:true, message:'Erreur mise à jour', severity:'error' }); }
  };

  const saveGroups = async (user: EditableUser) => {
    try {
      await client.models.UserProfile.update({ id: user.id, groups: user.groups, updatedBy: 'admin' });
      setRows(prev => prev.map(r => r.id === user.id ? { ...r, dirty:false } : r));
      setSnackbar({ open:true, message:'Groupes sauvegardés', severity:'success' });
    } catch { setSnackbar({ open:true, message:'Erreur sauvegarde', severity:'error' }); }
  };

  const handleGroupsChange = (user: EditableUser, value: string) => {
    const groups = value.split(',').map(v => v.trim()).filter(Boolean);
    setRows(prev => prev.map(r => r.id === user.id ? { ...r, groups, dirty:true } : r));
  };

  if (isAdmin === null) return <Box sx={{p:4}}>Chargement...</Box>;
  if (!isAdmin) return <Box sx={{p:4}}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{ p:4 }}>
      <Typography variant="h5" sx={{ fontWeight:600, color:'#894991', mb:3 }}>Administration - Utilisateurs</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nom</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Groupes (liste séparée par virgules)</TableCell>
            <TableCell align="center">Actif</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id} hover>
              <TableCell>{r.displayName}</TableCell>
              <TableCell>{r.email}</TableCell>
              <TableCell sx={{ minWidth:260 }}>
                <TextField size="small" fullWidth value={r.groups.join(', ')} onChange={e=>handleGroupsChange(r, e.target.value)} placeholder="USERS, ADMINS" />
              </TableCell>
              <TableCell align="center"><Switch size="small" checked={r.active!==false} onChange={()=>toggleActive(r)} /></TableCell>
              <TableCell align="right">
                <Tooltip title={r.dirty ? 'Sauvegarder groupes' : 'Aucune modification'}>
                  <span>
                    <IconButton size="small" color={r.dirty? 'primary':'default'} disabled={!r.dirty} onClick={()=>saveGroups(r)}>
                      <SaveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {rows.length===0 && !loading && <TableRow><TableCell colSpan={5} align="center" sx={{ py:3, color:'#777' }}>Aucun utilisateur</TableCell></TableRow>}
        </TableBody>
      </Table>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={()=>setSnackbar(s=>({...s,open:false}))}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({...s,open:false}))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
