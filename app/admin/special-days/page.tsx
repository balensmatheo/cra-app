"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, Snackbar, Alert, IconButton, Tooltip, Chip, Divider, CircularProgress, Dialog, DialogTitle, DialogActions, DialogContent, List, ListItem, ListItemText, ListItemIcon, Avatar, FormControl, InputLabel } from '@mui/material';
import { useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EventIcon from '@mui/icons-material/Event';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIconOutline from '@mui/icons-material/DeleteOutline';
import ImageIcon from '@mui/icons-material/Image';
import { uploadData } from 'aws-amplify/storage';

const client = generateClient<Schema>();

type EditableSD = { id?: string; date: string; type: 'ferie'|'seminaire'|'conge_obligatoire'|'autre'; scope: 'global'|'user'; userId?: string|null };
type DisplayRow =
  | { kind: 'single'; id?: string; date: string; type: EditableSD['type']; scope: EditableSD['scope']; userId?: string|null }
  | { kind: 'seminar-group'; ids: string[]; startDate: string; endDate: string; type: 'seminaire'; scope: EditableSD['scope']; userId?: string|null };

export default function AdminSpecialDaysPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<EditableSD[]>([]);
  const [snackbar, setSnackbar] = useState<{open:boolean;message:string;severity:'success'|'error'|'info'}>({open:false,message:'',severity:'info'});
  const [newRow, setNewRow] = useState<EditableSD>({ date: '', type: 'ferie', scope:'global' });
  const [users, setUsers] = useState<Array<{ username: string; given_name?: string; family_name?: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  // Seminar creation dialog
  const [seminarDialog, setSeminarDialog] = useState<{
    open: boolean;
    startDate: string;
    endDate: string;
    location: string;
    activities: string;
    details: string;
  imageUrl: string; // Will store the S3 key (e.g., public/seminars/...)
    scope: 'global' | 'user';
    userId: string | null;
    loading: boolean;
  }>({
    open: false,
    startDate: '',
    endDate: '',
    location: '',
    activities: '',
    details: '',
  imageUrl: '',
    scope: 'global',
    userId: null,
    loading: false
  });
  // Refs to manage focus/open behavior between date fields
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const openEndPicker = useCallback(() => {
    const el = endDateRef.current as any;
    if (!el) return;
    try { el.focus(); } catch {}
    // Try to open the native date picker where supported
    try { if (typeof el.showPicker === 'function') el.showPicker(); } catch {}
    // Fallback: click to hint the UI
    try { el.click?.(); } catch {}
  }, []);
  // Local upload UI state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Filters
  const [filterType, setFilterType] = useState<'all'|'ferie'|'seminaire'|'conge_obligatoire'|'autre'>('all');
  const [filterScope, setFilterScope] = useState<'all'|'global'|'user'>('all');
  const [filterUser, setFilterUser] = useState<string>('');
  // Confirm dialog for delete
  const [confirm, setConfirm] = useState<{ open: boolean; ids: string[]; label: string }>({ open: false, ids: [], label: '' });
  // Response tracking dialog
  const [responseDialog, setResponseDialog] = useState<{
    open: boolean;
    startDate: string;
    endDate: string;
    responses: Array<{
      userId: string;
      status: 'pending' | 'accepted' | 'refused';
      refuseReason?: string;
    }>;
    loading: boolean;
  }>({ open: false, startDate: '', endDate: '', responses: [], loading: false });

  useEffect(() => {
    fetchAuthSession().then(sess => {
      const groups = sess.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
      setIsAdmin(groups?.includes('ADMINS') || false);
    }).catch(()=> setIsAdmin(false));
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setTableLoading(true);
      const { data } = await client.models.SpecialDay.list({});
      setRows((data||[]) as any);
    } catch { setSnackbar({open:true,message:'Erreur chargement',severity:'error'}); }
    finally { setTableLoading(false); }
  }, [isAdmin]);

  useEffect(()=>{ if (isAdmin) load(); }, [isAdmin, load]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        setUsersLoading(true);
        const { data, errors } = await client.queries.listUsers({});
        if (!errors) {
          const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
          const list = (payload?.users || []) as any[];
          setUsers(list.map(u => ({ username: u.username, given_name: u.given_name, family_name: u.family_name })));
        }
      } catch {
        // ignore; selector will fallback
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [isAdmin]);

  const displayName = (uid?: string|null) => {
    if (!uid) return '';
    const u = users.find(x => x.username === uid);
    if (u) {
      const n = [u.given_name, u.family_name].filter(Boolean).join(' ');
      return n || uid;
    }
    return uid;
  };

  const broadcast = () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cra:special-days-updated')); };
  useEffect(() => {
    const onUpd = () => load();
    if (typeof window !== 'undefined') window.addEventListener('cra:special-days-updated', onUpd as any);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('cra:special-days-updated', onUpd as any); };
  }, [load]);

  // Ensure "Férié" category exists
  const ensureFerieCategoryId = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await client.models.Category.list({});
      const all = (data || []) as any[];
      const found = all.find(c => {
        const lbl = (c.label || '').toLowerCase();
        return lbl === 'férié' || lbl === 'ferie' || lbl === 'férié ' || lbl === 'jour férié' || lbl === 'jour ferie';
      });
      if (found) return found.id as string;
      const created = await (client.models.Category.create as any)({ label: 'Férié', kind: 'autre' as any });
      return (created as any)?.data?.id || (created as any)?.id || null;
    } catch (e) { return null; }
  }, [client]);

  const ensureCraForMonth = useCallback(async (ownerSub: string, month: string) => {
    const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
    let cra = (cras || []).find(c => (c as any).owner === ownerSub);
    if (!cra) {
      const created = await client.models.Cra.create({ month, status: 'draft' as any, isSubmitted: false as any, owner: ownerSub as any });
      cra = ((created as any)?.data) || (created as any);
    }
    return cra as any;
  }, [client]);

  const applyHolidayToUserCra = useCallback(async (ownerSub: string, date: string) => {
    const categoryId = await ensureFerieCategoryId();
    if (!categoryId) return;
    const month = date.slice(0,7);
    const cra = await ensureCraForMonth(ownerSub, month);
    if (!cra) return;
    const craId = (cra as any).id as string;
    const cmnt = '[FERIE] Jour férié';
    try {
      const { data: existingRaw } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId }, date: { eq: date } } });
      const existing = (existingRaw || []) as any[];
      if (existing.length > 0) {
        try {
          await client.models.CraEntry.update({ id: (existing[0] as any).id, craId: craId as any, date, categoryId: categoryId as any, value: 1 as any, comment: cmnt, owner: ownerSub as any });
        } catch {}
      } else {
        try {
          await client.models.CraEntry.create({ craId: craId as any, date, categoryId: categoryId as any, value: 1 as any, comment: cmnt, owner: ownerSub as any });
        } catch {}
      }
      try { await client.models.Cra.update({ id: craId, status: 'saved' as any }); } catch {}
    } catch {}
  }, [client, ensureCraForMonth, ensureFerieCategoryId]);

  // Handle seminar creation
  const createSeminar = async () => {
    const { startDate, endDate, location, activities, details, imageUrl, scope, userId } = seminarDialog;
    if (!startDate || !endDate) {
      setSnackbar({open:true,message:'Sélectionnez une période (début et fin)',severity:'error'});
      return;
    }
    if (startDate > endDate) {
      setSnackbar({open:true,message:'La date de début doit précéder la date de fin',severity:'error'});
      return;
    }
    if (scope === 'user' && !userId) {
      setSnackbar({open:true,message:'Sélectionnez un utilisateur',severity:'error'});
      return;
    }

    setSeminarDialog(prev => ({ ...prev, loading: true }));
    try {
      // Enumerate days inclusive in UTC to avoid host TZ/DST issues; admin expects Europe/Paris calendar days
      const dates: string[] = [];
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      let t = Date.UTC(sy, (sm || 1) - 1, sd || 1);
      const endUtc = Date.UTC(ey, (em || 1) - 1, ed || 1);
      const dayMs = 24 * 60 * 60 * 1000;
      while (t <= endUtc) {
        const d = new Date(t);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${dd}`);
        t += dayMs;
      }
      const created: any[] = [];
      for (const date of dates) {
        const res = await client.models.SpecialDay.create({
          date,
          type: 'seminaire' as any,
          scope: scope as any,
          userId: scope === 'user' ? (userId as any) : undefined,
        } as any);
        if (res.data) created.push(res.data);
      }
      // Create SeminarInvite(s)
      try {
        const targets: string[] = scope === 'user' && userId ? [userId] : users.map(u => u.username);
        console.log('Creating seminar invites for targets:', targets);
        let inviteCount = 0;
        for (const sub of targets) {
          try {
            const invite = await (client.models.SeminarInvite.create as any)({
              startDate,
              endDate,
              title: 'Séminaire',
              message: '',
              location,
              activities,
              details,
              imageUrl,
              status: 'pending' as any,
              owner: sub as any,
            });
            console.log('Created invite for user:', sub, 'Result:', invite);
            inviteCount++;
          } catch (err) {
            console.error('Failed to create invite for user:', sub, 'Error:', err);
          }
        }
        console.log(`Successfully created ${inviteCount} out of ${targets.length} invites`);
      } catch (err) {
        console.error('Error in seminar invite creation:', err);
      }
      if (created.length) setRows(prev => [...prev, ...created as any]);
      setSeminarDialog({
        open: false,
        startDate: '',
        endDate: '',
        location: '',
        activities: '',
        details: '',
        imageUrl: '',
        scope: 'global',
        userId: null,
        loading: false
      });
      setSnackbar({open:true,message:`Séminaire ajouté (${dates.length} jour${dates.length>1?'s':''}) et invitations envoyées`,severity:'success'});
      broadcast();
    } catch {
      setSnackbar({open:true,message:'Erreur lors de la création du séminaire',severity:'error'});
    } finally {
      setSeminarDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // Drag & drop / file selection handler for image upload
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: "Le fichier doit être une image", severity: 'error' });
      return;
    }
    // Preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setUploading(true);
    setUploadProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Use protected/ prefix per amplify/storage policy (authenticated users/groups have write access)
      const key = `protected/seminars/${Date.now()}_${safeName}`;
      await uploadData({
        path: key,
        data: file,
        options: {
          contentType: file.type,
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) setUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
          },
        },
      }).result;
      setSeminarDialog(prev => ({ ...prev, imageUrl: key }));
      setSnackbar({ open: true, message: 'Image téléchargée avec succès', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, message: "Échec de l'upload de l'image", severity: 'error' });
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    if (newRow.type === 'seminaire') {
      setSnackbar({open:true,message:'Utilisez le bouton "Ajouter un séminaire" pour créer un séminaire',severity:'info'});
      return;
    }
    if (newRow.scope === 'user' && !newRow.userId) {
      setSnackbar({open:true,message:'Sélectionnez un utilisateur',severity:'error'});
      return;
    }
    if (!newRow.date) {
      setSnackbar({open:true,message:'Date requise',severity:'error'});
      return;
    }
    try {
      const res = await client.models.SpecialDay.create(newRow as any);
      if (res.data) setRows(prev => [...prev, res.data as any]);
      // If it's a holiday, auto-fill CRA for affected users
      if (newRow.type === 'ferie') {
        try {
          const targets: string[] = newRow.scope === 'user' && newRow.userId ? [newRow.userId] : users.map(u => u.username);
          for (const sub of targets) {
            await applyHolidayToUserCra(sub, newRow.date);
          }
        } catch {}
      }
      setNewRow({ date:'', type:'ferie', scope:'global' });
      setSnackbar({open:true,message: newRow.type === 'ferie' ? 'Jour férié ajouté et appliqué aux CRA' : 'Jour spécial ajouté',severity:'success'});
      broadcast();
    } catch { setSnackbar({open:true,message:'Erreur ajout',severity:'error'}); }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    try {
      // Find the row being deleted to determine type and date
      const row = rows.find(r => r.id === id);
      if (row && row.type === 'seminaire') {
        const date = row.date;
        const startDate = date;
        const endDate = date;
  // For seminar day deletion, remove the entire Séminaire line for that month for accepted users
        try {
          const { data: invites } = await (client.models.SeminarInvite.list as any)({
            filter: { startDate: { eq: startDate }, endDate: { eq: endDate } }
          });
          const acceptedUsers: string[] = ((invites || []) as any[])
            .filter((inv: any) => inv.status === 'accepted')
            .map((inv: any) => inv.owner);
          if (acceptedUsers.length > 0) {
            const { data: categories } = await client.models.Category.list({});
            const seminaireCategory = (categories || []).find((c: any) =>
              (c.label || '').toLowerCase() === 'séminaire' || (c.label || '').toLowerCase() === 'seminaire'
            );
            if (seminaireCategory) {
              const categoryId = (seminaireCategory as any).id as string;
              const month = date.slice(0, 7);
              for (const userSub of acceptedUsers) {
                try {
                  const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
                  const userCra = (cras || []).find((c: any) => c.owner === userSub);
                  if (userCra) {
                    // Delete all entries for Séminaire category for this month (entire line)
                    const { data: entries } = await (client.models.CraEntry.list as any)({
                      filter: { craId: { eq: (userCra as any).id }, categoryId: { eq: categoryId } }
                    });
                    if ((entries || []).length > 0) {
                      await Promise.all((entries || []).map((e: any) => client.models.CraEntry.delete({ id: e.id })));
                      try { await client.models.Cra.update({ id: (userCra as any).id, status: 'saved' as any }); } catch {}
                    }
                  }
                } catch {}
              }
              if (typeof window !== 'undefined') { window.dispatchEvent(new Event('cra:entries-updated')); }
            }
          }
        } catch {}
      }
      await client.models.SpecialDay.delete({ id });
      setRows(prev => prev.filter(r => r.id !== id));
      setSnackbar({open:true,message:'Supprimé',severity:'success'});
      broadcast();
    } catch { setSnackbar({open:true,message:'Erreur suppression',severity:'error'}); }
  };

  const removeMany = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      // Find the seminar group to get date range
      const seminarRows = rows.filter(r => ids.includes(r.id as string) && r.type === 'seminaire');
      if (seminarRows.length > 0) {
        // Find the date range of this seminar
        const dates = seminarRows.map(r => r.date).sort();
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        // Get all invites for this seminar
        let acceptedUsers: string[] = [];
        try {
          const { data: invites } = await (client.models.SeminarInvite.list as any)({
            filter: {
              startDate: { eq: startDate },
              endDate: { eq: endDate }
            }
          });
          
          if (invites && invites.length > 0) {
            // Collect users who accepted the seminar
            acceptedUsers = invites
              .filter((inv: any) => inv.status === 'accepted')
              .map((inv: any) => inv.owner);
            
            // Delete all SeminarInvite entries
            await Promise.all(invites.map((inv: any) =>
              client.models.SeminarInvite.delete({ id: inv.id })
            ));
          }
        } catch (e) {
          console.error('Error deleting seminar invites:', e);
        }
        
    // Remove CRA entries for users who accepted the seminar
        if (acceptedUsers.length > 0) {
          try {
            // Find the Séminaire category
            const { data: categories } = await client.models.Category.list({});
            const seminaireCategory = (categories || []).find((c: any) =>
              (c.label || '').toLowerCase() === 'séminaire' ||
              (c.label || '').toLowerCase() === 'seminaire'
            );
            
            if (seminaireCategory) {
              const categoryId = seminaireCategory.id;
              
      // Enumerate all days (including weekends) for the seminar period
      const allDays = enumerateAllDays(startDate, endDate);
              
              // For each user who accepted, remove the entire Séminaire line for affected months
              for (const userSub of acceptedUsers) {
                // Determine affected months from the period
                const months = Array.from(new Set(allDays.map(d => d.slice(0,7))));
                for (const month of months) {
                  try {
                    // Find the user's CRA for this month
                    const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
                    const userCra = (cras || []).find((c: any) => c.owner === userSub);
                    if (!userCra) continue;
                    // Delete all entries in Séminaire category for this CRA (entire line)
                    const { data: entries } = await (client.models.CraEntry.list as any)({
                      filter: { craId: { eq: (userCra as any).id }, categoryId: { eq: categoryId } }
                    });
                    if ((entries || []).length > 0) {
                      await Promise.all((entries || []).map((e: any) => client.models.CraEntry.delete({ id: (e as any).id })));
                      await client.models.Cra.update({ id: (userCra as any).id, status: 'saved' as any });
                    }
                  } catch (e) {
                    console.error(`Error removing CRA entries for user ${userSub} in month ${month}:`, e);
                  }
                }
              }
              
              // Dispatch event to refresh CRA views
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('cra:entries-updated'));
              }
            }
          } catch (e) {
            console.error('Error removing CRA entries for seminar:', e);
          }
        }
      }
      
      // Delete SpecialDay entries
      await Promise.all(ids.map(id => client.models.SpecialDay.delete({ id })));
      setRows(prev => prev.filter(r => !ids.includes(r.id as string)));
      setSnackbar({open:true,message:`Supprimé (${ids.length})`,severity:'success'});
      broadcast();
    } catch { setSnackbar({open:true,message:'Erreur suppression',severity:'error'}); }
  };

  // Helper: enumerate weekdays (Mon-Fri) using UTC to avoid DST/TZ issues
  const enumerateWeekdays = (start: string, end: string): string[] => {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const out: string[] = [];
    let t = Date.UTC(sy, (sm || 1) - 1, sd || 1);
    const endUtc = Date.UTC(ey, (em || 1) - 1, ed || 1);
    const dayMs = 24 * 60 * 60 * 1000;
    while (t <= endUtc) {
      const d = new Date(t);
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        out.push(`${y}-${m}-${dd}`);
      }
      t += dayMs;
    }
    return out;
  };

  // Helper: enumerate all days inclusive (local time) between start and end
  const enumerateAllDays = (start: string, end: string): string[] => {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const out: string[] = [];
    const s = new Date(sy, (sm || 1) - 1, sd || 1);
    const e = new Date(ey, (em || 1) - 1, ed || 1);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${dd}`);
    }
    return out;
  };

  // Fetch seminar responses
  const fetchSeminarResponses = async (startDate: string, endDate: string) => {
    setResponseDialog(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await (client.models.SeminarInvite.list as any)({
        filter: {
          startDate: { eq: startDate },
          endDate: { eq: endDate }
        }
      });
      const invites = (data || []) as any[];
      const responses = invites.map(inv => ({
        userId: inv.owner,
        status: inv.status || 'pending',
        refuseReason: inv.refuseReason
      }));
      setResponseDialog(prev => ({
        ...prev,
        responses,
        loading: false
      }));
    } catch {
      setSnackbar({open:true,message:'Erreur chargement des réponses',severity:'error'});
      setResponseDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const openResponseDialog = (startDate: string, endDate: string) => {
    setResponseDialog({
      open: true,
      startDate,
      endDate,
      responses: [],
      loading: false
    });
    fetchSeminarResponses(startDate, endDate);
  };

  const closeResponseDialog = () => {
    setResponseDialog({
      open: false,
      startDate: '',
      endDate: '',
      responses: [],
      loading: false
    });
  };

  // Count responses by status
  const responseStats = useMemo(() => {
    const stats = {
      total: responseDialog.responses.length,
      accepted: responseDialog.responses.filter(r => r.status === 'accepted').length,
      refused: responseDialog.responses.filter(r => r.status === 'refused').length,
      pending: responseDialog.responses.filter(r => r.status === 'pending').length
    };
    return stats;
  }, [responseDialog.responses]);

  // Build display rows: group seminars over contiguous dates per (scope,userId)
  const displayRows: DisplayRow[] = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const others: DisplayRow[] = [];
    const seminarsByKey: Record<string, Array<Required<EditableSD>>> = {} as any;
    const norm = (d: string) => d; // already 'YYYY-MM-DD'
    for (const r of rows) {
      if (r.type === 'seminaire') {
        const k = `${r.scope}:${r.userId || '-'}`;
        (seminarsByKey[k] ||= []).push({ ...(r as any) });
      } else {
        others.push({ kind: 'single', id: r.id, date: r.date, type: r.type, scope: r.scope, userId: r.userId });
      }
    }
    const groups: DisplayRow[] = [];
    const addDays = (dateStr: string, days: number) => {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    Object.entries(seminarsByKey).forEach(([key, items]) => {
      items.sort((a, b) => norm(a.date).localeCompare(norm(b.date)));
      let i = 0;
      while (i < items.length) {
        const start = items[i];
        let end = start;
        let j = i + 1;
        const ids: string[] = [start.id as string];
        while (j < items.length) {
          const expected = addDays(end.date, 1);
          if (items[j].date === expected) {
            end = items[j];
            ids.push(items[j].id as string);
            j++;
          } else {
            break;
          }
        }
        groups.push({ kind: 'seminar-group', ids, startDate: start.date, endDate: end.date, type: 'seminaire', scope: start.scope, userId: start.userId });
        i = j;
      }
    });
    // Merge others and groups in a single list, sorted by date/start
    const combined = [
      ...others,
      ...groups
    ];
    combined.sort((a, b) => {
      const aDate = a.kind === 'single' ? a.date : a.startDate;
      const bDate = b.kind === 'single' ? b.date : b.startDate;
      return String(aDate).localeCompare(String(bDate));
    });
    return combined;
  }, [rows]);

  // Apply filters to displayRows
  const filteredRows: DisplayRow[] = useMemo(() => {
    return displayRows.filter(r => {
      const t = r.kind === 'single' ? r.type : r.type;
      if (filterType !== 'all' && t !== filterType) return false;
      const sc = r.kind === 'single' ? r.scope : r.scope;
      if (filterScope !== 'all' && sc !== filterScope) return false;
      if (filterUser.trim()) {
        const needle = filterUser.trim().toLowerCase();
        if (sc === 'user') {
          const label = (displayName(r.kind === 'single' ? r.userId : r.userId) || (r.kind === 'single' ? r.userId : r.userId) || '').toLowerCase();
          if (!label.includes(needle)) return false;
        } else {
          // for global, match 'tous'
          if (!'tous'.includes(needle)) return false;
        }
      }
      return true;
    });
  }, [displayRows, filterType, filterScope, filterUser]);

  if (isAdmin === null) return <Box sx={{p:4}}>Chargement...</Box>;
  if (!isAdmin) return <Box sx={{p:4}}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{ p:4 }}>
      <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px solid #ecdef3', background: 'linear-gradient(180deg, #fbf7fc 0%, #f4ecf7 100%)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:1.5 }}>
        <Typography variant="h6" sx={{ fontWeight:800, color:'#6a3a7a', letterSpacing:.2 }}>Administration — Jours spéciaux</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} sx={{ textTransform:'none', borderColor:'#d1d5db', color:'#374151' }}>Rafraîchir</Button>
        </Box>
      </Box>


  <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', alignItems:'center', mb:2, p:1.25, border:'1px solid #eee', borderRadius:1.5 }}>
        <TextField size="small" type="date" label="Date" InputLabelProps={{shrink:true}} value={newRow.date} onChange={e=>setNewRow(r=>({...r, date:e.target.value}))} />
        <Select size="small" value={newRow.type} onChange={e=>setNewRow(r=>({...r, type: e.target.value as any}))}>
          <MenuItem value="ferie">Férié</MenuItem>
          <MenuItem value="conge_obligatoire">Congé obligatoire</MenuItem>
          <MenuItem value="autre">Autre</MenuItem>
        </Select>
        <Select size="small" value={newRow.scope} onChange={e=>setNewRow(r=>({...r, scope: e.target.value as any}))}>
          <MenuItem value="global">Global</MenuItem>
          <MenuItem value="user">Utilisateur</MenuItem>
        </Select>
        {newRow.scope === 'user' && (
          <Select
            size="small"
            value={newRow.userId || ''}
            onChange={e=>setNewRow(r=>({...r, userId: e.target.value as string }))}
            displayEmpty
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="" disabled>{usersLoading ? 'Chargement des utilisateurs…' : 'Choisir un utilisateur'}</MenuItem>
            {users.map(u => {
              const name = [u.given_name, u.family_name].filter(Boolean).join(' ') || u.username;
              return <MenuItem key={u.username} value={u.username}>{name}</MenuItem>;
            })}
          </Select>
        )}
  <Button variant="contained" startIcon={<AddIcon />} onClick={add} sx={{ backgroundColor:'primary.main', '&:hover':{ background:'#6a3a7a' } }}>Ajouter</Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display:'flex', alignItems:'center', gap:1, flexWrap:'wrap', mb:2 }}>
        <Select size="small" value={filterType} onChange={e=>setFilterType(e.target.value as any)}>
          <MenuItem value="all">Tous les types</MenuItem>
          <MenuItem value="ferie">Férié</MenuItem>
          <MenuItem value="seminaire">Séminaire</MenuItem>
          <MenuItem value="conge_obligatoire">Congé obligatoire</MenuItem>
          <MenuItem value="autre">Autre</MenuItem>
        </Select>
        <Select size="small" value={filterScope} onChange={e=>setFilterScope(e.target.value as any)}>
          <MenuItem value="all">Toutes portées</MenuItem>
          <MenuItem value="global">Global</MenuItem>
          <MenuItem value="user">Utilisateur</MenuItem>
        </Select>
        <TextField size="small" placeholder="Filtrer par utilisateur (nom ou ‘tous’)" value={filterUser} onChange={e=>setFilterUser(e.target.value)} />
      </Box>

      <Box sx={{ position:'relative' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date / Période</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Portée</TableCell>
            <TableCell>Utilisateur</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredRows.map((r, idx) => (
            r.kind === 'single' ? (
              <TableRow key={r.id || `s-${idx}`}>
                <TableCell>{r.date}</TableCell>
                <TableCell>
                  <Chip size="small" label={r.type} color={r.type==='ferie'?'success':r.type==='seminaire'?'primary':r.type==='conge_obligatoire'?'warning':'default'} variant={r.type==='autre'?'outlined':'filled'} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={r.scope==='global'?'Global':'Utilisateur'} color={r.scope==='global'?'secondary':'default'} variant="outlined" />
                </TableCell>
                <TableCell>{r.scope === 'user' ? (displayName(r.userId) || r.userId || '-') : 'tous'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Supprimer"><span><IconButton size="small" color="error" onClick={()=> setConfirm({ open: true, ids: r.id ? [r.id] : [], label: r.date })}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={`g-${r.ids[0]}`}>
                <TableCell>{r.startDate} → {r.endDate}</TableCell>
                <TableCell>
                  <Chip size="small" label={r.type} color={r.type==='seminaire'?'primary':'default'} />
                  <Chip size="small" label={`${r.ids.length} jour${r.ids.length>1?'s':''}`} sx={{ ml: 1 }} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={r.scope==='global'?'Global':'Utilisateur'} color={r.scope==='global'?'secondary':'default'} variant="outlined" />
                </TableCell>
                <TableCell>{r.scope === 'user' ? (displayName(r.userId) || r.userId || '-') : 'tous'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Voir les réponses">
                    <span>
                      <IconButton size="small" color="primary" onClick={() => openResponseDialog(r.startDate, r.endDate)}>
                        <GroupIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={`Supprimer la période (${r.ids.length} jour${r.ids.length>1?'s':''})`}>
                    <span>
                      <IconButton size="small" color="error" onClick={()=> setConfirm({ open: true, ids: r.ids, label: `${r.startDate} → ${r.endDate}` })}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          ))}
          {filteredRows.length===0 && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py:3, color:'#777' }}>{tableLoading ? 'Chargement…' : 'Aucun jour spécial'}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {tableLoading && (
        <Box sx={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:'rgba(255,255,255,.5)' }}>
          <CircularProgress size={22} />
        </Box>
      )}
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={()=>setSnackbar(s=>({...s,open:false}))} anchorOrigin={{ vertical:'bottom', horizontal:'right' }}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({...s,open:false}))}>{snackbar.message}</Alert>
      </Snackbar>

      <Dialog open={confirm.open} onClose={()=>setConfirm({ open:false, ids:[], label:'' })}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>Voulez-vous supprimer {confirm.ids.length > 1 ? 'cette période' : 'cet élément'} ({confirm.label}) ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setConfirm({ open:false, ids:[], label:'' })}>Annuler</Button>
          <Button color="error" variant="contained" onClick={async ()=>{
            const ids = confirm.ids;
            setConfirm({ open:false, ids:[], label:'' });
            if (ids.length > 1) await removeMany(ids);
            else if (ids.length === 1) await remove(ids[0]);
          }}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Response tracking dialog */}
      <Dialog
        open={responseDialog.open}
        onClose={closeResponseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Réponses au séminaire
          <Typography variant="body2" color="text.secondary">
            {responseDialog.startDate} → {responseDialog.endDate}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {responseDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Statistics */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Chip
                  icon={<GroupIcon />}
                  label={`Total: ${responseStats.total}`}
                  variant="outlined"
                />
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Accepté: ${responseStats.accepted}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  icon={<CancelIcon />}
                  label={`Refusé: ${responseStats.refused}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  icon={<HourglassEmptyIcon />}
                  label={`En attente: ${responseStats.pending}`}
                  color="warning"
                  variant="outlined"
                />
              </Box>

              {/* Response list */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Détail des réponses :</Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {responseDialog.responses.map((response, idx) => (
                  <ListItem key={idx} divider>
                    <ListItemIcon>
                      <Avatar sx={{
                        width: 32,
                        height: 32,
                        bgcolor: response.status === 'accepted' ? 'success.main' :
                                response.status === 'refused' ? 'error.main' :
                                'warning.main'
                      }}>
                        {response.status === 'accepted' ? <CheckCircleIcon fontSize="small" /> :
                         response.status === 'refused' ? <CancelIcon fontSize="small" /> :
                         <HourglassEmptyIcon fontSize="small" />}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={displayName(response.userId) || response.userId}
                      secondary={
                        <>
                          <Chip
                            size="small"
                            label={
                              response.status === 'accepted' ? 'Accepté' :
                              response.status === 'refused' ? 'Refusé' :
                              'En attente'
                            }
                            color={
                              response.status === 'accepted' ? 'success' :
                              response.status === 'refused' ? 'error' :
                              'warning'
                            }
                            sx={{ mr: 1 }}
                          />
                          {response.status === 'refused' && response.refuseReason && (
                            <Typography variant="body2" component="span" color="text.secondary">
                              Raison: {response.refuseReason}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResponseDialog}>Fermer</Button>
        </DialogActions>
      </Dialog>

  {/* Seminar creation dialog migrated to the Séminaires page */}
    </Box>
  );
}
