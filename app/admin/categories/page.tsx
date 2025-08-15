"use client";
import { useEffect, useState, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, Switch, FormControl, InputLabel, Select, MenuItem, Snackbar, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const client = generateClient<Schema>();
interface EditableCategory { id?: string; label: string; kind: string; active: boolean; }

export default function AdminCategoriesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<EditableCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{open:boolean; message:string; severity:'success'|'error'|'info'}>({open:false,message:'',severity:'info'});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableCategory | null>(null);

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
      const { data } = await client.models.Category.list({});
      setRows((data || []).map(c => ({ id: c.id, label: c.label || '', kind: (c as any).kind || 'autre', active: (c as any).active !== false })));
    } catch (e:any) {
      setSnackbar({open:true,message:'Erreur chargement',severity:'error'});
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(()=>{ if (isAdmin) load(); }, [isAdmin, load]);

  const openCreate = () => { setEditing({ label:'', kind:'autre', active:true }); setDialogOpen(true); };
  const openEdit = (cat: EditableCategory) => { setEditing({...cat}); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const broadcast = () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cra:categories-updated')); };

  const saveCategory = async () => {
    if (!editing) return;
    if (!editing.label.trim()) { setSnackbar({open:true,message:'Label requis',severity:'error'}); return; }
    try {
      if (editing.id) {
        await client.models.Category.update({ id: editing.id, label: editing.label, kind: editing.kind as any, active: editing.active });
        setSnackbar({open:true,message:'Catégorie mise à jour',severity:'success'});
      } else {
        await client.models.Category.create({ label: editing.label, kind: editing.kind as any, active: editing.active });
        setSnackbar({open:true,message:'Catégorie créée',severity:'success'});
      }
      closeDialog();
      load();
      broadcast();
    } catch (e:any) {
      setSnackbar({open:true,message:'Erreur sauvegarde',severity:'error'});
    }
  };

  const toggleActive = async (cat: EditableCategory) => {
    try {
      await client.models.Category.update({ id: cat.id!, active: !cat.active });
      setRows(prev => prev.map(r => r.id === cat.id ? { ...r, active: !r.active } : r));
      broadcast();
    } catch { setSnackbar({open:true,message:'Erreur',severity:'error'}); }
  };

  const handleDelete = async (cat: EditableCategory) => {
    if (!cat.id) return;
    try {
      // Vérifier utilisation (au moins une entrée CRA)
      const { data: used } = await (client.models.CraEntry.list as any)({ filter: { categoryId: { eq: cat.id } }, limit: 1 });
      if (used && used.length > 0) {
        setSnackbar({ open:true, message:'Impossible: catégorie utilisée dans des CRA', severity:'error' });
        return;
      }
      await client.models.Category.delete({ id: cat.id });
      setRows(prev => prev.filter(r => r.id !== cat.id));
      setSnackbar({ open:true, message:'Catégorie supprimée', severity:'success' });
      broadcast();
    } catch {
      setSnackbar({ open:true, message:'Suppression échouée', severity:'error' });
    }
  };

  if (isAdmin === null) return <Box sx={{p:4}}>Chargement...</Box>;
  if (!isAdmin) return <Box sx={{p:4}}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{p:4}}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Typography variant="h5" sx={{ fontWeight:600, color:'#894991' }}>Administration - Catégories</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ background:'#894991', '&:hover':{ background:'#6a3a7a' } }}>Nouvelle</Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Label</TableCell>
            <TableCell>Kind</TableCell>
            <TableCell align="center">Active</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id} hover>
              <TableCell>{r.label}</TableCell>
              <TableCell>{r.kind}</TableCell>
              <TableCell align="center"><Switch size="small" checked={r.active} onChange={() => toggleActive(r)} /></TableCell>
              <TableCell align="right" sx={{ display:'flex', gap:0.5, justifyContent:'flex-end' }}>
                <Tooltip title="Modifier"><IconButton size="small" onClick={()=>openEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title={r.id ? 'Supprimer' : ''}>
                  <span>
                    <IconButton size="small" onClick={()=>handleDelete(r)} disabled={!r.id} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} align="center" sx={{ py:3, color:'#777' }}>Aucune catégorie</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editing?.id ? 'Modifier catégorie' : 'Nouvelle catégorie'}</DialogTitle>
        <DialogContent dividers sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Label" value={editing?.label || ''} onChange={e=>setEditing(ed => ed ? { ...ed, label: e.target.value } : ed)} size="small" fullWidth />
          <FormControl size="small" fullWidth>
            <InputLabel>Kind</InputLabel>
            <Select label="Kind" value={editing?.kind || 'autre'} onChange={e=>setEditing(ed => ed ? { ...ed, kind: e.target.value } : ed)}>
              <MenuItem value="facturee">facturee</MenuItem>
              <MenuItem value="non_facturee">non_facturee</MenuItem>
              <MenuItem value="autre">autre</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <Switch size="small" checked={!!editing?.active} onChange={e=>setEditing(ed => ed ? { ...ed, active: e.target.checked } : ed)} />
            <Typography variant="body2">Active</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} size="small">Annuler</Button>
          <Button variant="contained" size="small" onClick={saveCategory} sx={{ background:'#894991', '&:hover':{ background:'#6a3a7a' } }}>Sauvegarder</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={()=>setSnackbar(s=>({...s,open:false}))}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({...s,open:false}))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
