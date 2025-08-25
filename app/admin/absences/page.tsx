"use client";

import React, { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Box, Typography, Grid, Card, CardContent, Chip, Stack, MenuItem, Select, InputLabel, FormControl, TextField, Button, IconButton, Tooltip, Link as MuiLink, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { getUrl } from 'aws-amplify/storage';
import CircularProgress from '@mui/material/CircularProgress';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

const client = generateClient<Schema>();

type LR = Schema['LeaveRequest']['type'];

type FilterStatus = 'pending' | 'approuvee' | 'refusee' | 'all';

function AdminAbsencesPageInner() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [list, setList] = useState<LR[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending');
  const [query, setQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<LR | null>(null);
  const [noteText, setNoteText] = useState('');
  const [targetStatus, setTargetStatus] = useState<Exclude<FilterStatus,'pending'|'all'> | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState<'approuvee' | 'refusee' | null>(null);
  // Revoke-specific UI state
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success'|'error'|'info' }>({ open: false, message: '', severity: 'success' });
  // Cache des noms des utilisateurs (owner sub -> prénom/nom)
  const [userNameMap, setUserNameMap] = useState<Record<string, { given: string; family: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchAuthSession();
        const groups = s.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        setIsAdmin(!!groups?.includes('ADMINS'));
      } catch { setIsAdmin(false); }
    })();
  }, []);

  const load = async () => {
    try {
      const { data } = await client.models.LeaveRequest.list({});
      setList((data || []) as LR[]);
    } catch {}
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  // Auto-prune: delete absences whose endDate is past (only non-pending) to free space
  const prunedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin) return;
    if (prunedRef.current) return;
    if (!list || list.length === 0) return;
    const today = new Date();
    today.setHours(0,0,0,0);
    const toDelete = list.filter((lr:any) => {
      if (!lr?.endDate) return false;
      const st = lr?.status;
      if (st === 'pending') return false;
      const d = new Date(String(lr.endDate) + 'T00:00:00');
      return d < today;
    });
    if (toDelete.length === 0) { prunedRef.current = true; return; }
    (async () => {
      try {
        await Promise.allSettled(toDelete.map((lr:any) => client.models.LeaveRequest.delete({ id: lr.id })));
        setSnackbar({ open: true, message: `${toDelete.length} demande(s) ancienne(s) supprimée(s)`, severity: 'info' });
        prunedRef.current = true;
        await load();
      } catch {
        // ignore errors silently; not critical
        prunedRef.current = true;
      }
    })();
  }, [isAdmin, list]);

  // Auto-open a request when ?request=<id> is present
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const q = searchParams?.get ? searchParams.get('request') : null;
    if (!q) return;
    // wait until list is loaded
    if (!list || list.length === 0) return;
    const found = list.find(l => l.id === q);
    if (found) {
      setSelected(found as LR);
      setDetailsOpen(true);
      // remove the request param so the dialog doesn't re-open after actions
      try {
        router.replace(window.location.pathname);
      } catch {}
    }
  }, [searchParams, list]);

  // Charger les noms des propriétaires des demandes (prénom/nom)
  useEffect(() => {
    if (!isAdmin) return;
    const owners = Array.from(new Set((list || []).map(l => (l as any).owner).filter(Boolean)));
    const missing = owners.filter(o => !userNameMap[o]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(missing.map(async (sub) => {
        try {
          const { data, errors } = await (client.queries as any).getUser({ sub });
          if (errors && errors.length) throw new Error(errors[0].message || 'getUser error');
          const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
          const u = payload?.user;
          return [sub, { given: u?.given_name || '', family: u?.family_name || '' }] as const;
        } catch {
          return [sub, { given: '', family: '' }] as const;
        }
      }));
      if (!cancelled) {
        const patch: Record<string, { given: string; family: string }> = {};
        results.forEach(([sub, name]) => { patch[sub] = name; });
        setUserNameMap(prev => ({ ...prev, ...patch }));
      }
    })();
    return () => { cancelled = true; };
  }, [list, isAdmin, userNameMap]);

  // Helpers for CRA sync on approval (duplicated small utilities from Navbar)
  const ensureCongeCategoryId = async (): Promise<string | null> => {
    try {
      const { data } = await client.models.Category.list({});
      const all = (data || []) as any[];
      let conge = all.find(c => (c.label || '').toLowerCase() === 'congé' || (c.label || '').toLowerCase() === 'conge');
      if (conge) return conge.id as string;
      const created = await client.models.Category.create({ label: 'Congé', kind: 'autre' as any });
      return (created as any)?.data?.id || (created as any)?.id || null;
    } catch {
      return null;
    }
  };
  const ensureCraForMonth = async (ownerSub: string, month: string) => {
    const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
    let cra = (cras || []).find(c => (c as any).owner === ownerSub);
    if (!cra) {
      const created = await client.models.Cra.create({ month, status: 'draft' as any, isSubmitted: false as any, owner: ownerSub as any });
      cra = ((created as any)?.data) || (created as any);
    }
    return cra as any;
  };
  // UTC-safe weekdays enumeration to avoid TZ/DST issues
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
  const applyApprovedLeaveToCra = async (ownerSub: string, startDate: string, endDate: string, comment: string, leaveId?: string) => {
    const categoryId = await ensureCongeCategoryId();
    if (!categoryId) return;
    const weekdays = enumerateWeekdays(startDate, endDate);
    if (weekdays.length === 0) return;
    const byMonth: Record<string, string[]> = {};
    weekdays.forEach(d => { const m = d.slice(0,7); (byMonth[m] ||= []).push(d); });
    const cmnt = (comment || '').trim();
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (const [month, dates] of Object.entries(byMonth)) {
      const cra = await ensureCraForMonth(ownerSub, month);
      if (!cra || !(cra as any).id) continue;
      const craId = (cra as any).id as string;

      // Per-date authoritative operations with retries to ensure first day is included
      for (const d of dates) {
        let ok = false;
        for (let pass = 0; pass < 5 && !ok; pass++) {
          try {
            // Remove previous leave-sourced entries for this date (do not touch other sources)
            const { data: dayList } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId }, date: { eq: d } } });
            const dayEntries = (dayList || []) as any[];
            const toDelete = dayEntries.filter(e => String((e as any).sourceType||'') === 'leave');
            if (toDelete.length > 0) {
              await Promise.all(toDelete.map(e => client.models.CraEntry.delete({ id: (e as any).id })));
            }
            // Create Congé entry
            await client.models.CraEntry.create({
              craId: craId as any,
              date: d,
              categoryId: categoryId as any,
              value: 1 as any,
              comment: cmnt,
              sourceType: 'leave' as any,
              sourceId: leaveId as any,
              sourceNote: cmnt as any,
              owner: ownerSub as any,
            });
            // Verify
            const { data: verify } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId }, date: { eq: d } } });
            const cur = (verify || []) as any[];
            ok = cur.some(e => String((e as any).categoryId) === String(categoryId) && Number((e as any).value) === 1);
            if (!ok) await sleep(250);
          } catch {
            await sleep(250);
          }
        }
      }

      // Final reconciliation: ensure all expected weekdays exist; remove accidental weekend entries in the requested span
      try {
        const { data: allRaw } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
        const all = (allRaw || []) as any[];
        const weekdaySet = new Set(dates);
  const haveForCategory = new Set(all.filter(e => String((e as any).categoryId) === String(categoryId) && String((e as any).sourceType||'') === 'leave').map(e => (e as any).date as string));
        // Create any missing weekdays
        for (const d of dates) {
          if (!haveForCategory.has(d)) {
            try {
              await client.models.CraEntry.create({ craId: craId as any, date: d, categoryId: categoryId as any, value: 1 as any, comment: cmnt, sourceType: 'leave' as any, sourceId: leaveId as any, sourceNote: cmnt as any, owner: ownerSub as any });
            } catch {}
          }
        }
        // Remove weekend Congé entries in range defensively
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const s = Date.UTC(sy, (sm || 1) - 1, sd || 1);
        const e = Date.UTC(ey, (em || 1) - 1, ed || 1);
        for (const entry of all) {
          if (String((entry as any).categoryId) !== String(categoryId)) continue;
          const dstr = (entry as any).date as string;
          const [y, m, dd] = dstr.split('-').map(Number);
          const t = Date.UTC(y, (m || 1) - 1, dd || 1);
          if (t < s || t > e) continue;
          const wd = new Date(t).getUTCDay();
          if (wd === 0 || wd === 6) {
            try { await client.models.CraEntry.delete({ id: (entry as any).id }); } catch {}
          }
        }
      } catch {}

      try { await client.models.Cra.update({ id: craId, status: 'saved' as any }); } catch {}
    }

    if (typeof window !== 'undefined') { try { window.dispatchEvent(new Event('cra:entries-updated')); } catch {} }
  };

  // Revert: remove all Congé entries (entire line) for affected month(s)
  const removeApprovedLeaveFromCra = async (ownerSub: string, startDate: string, endDate: string, leaveId?: string) => {
    const days = enumerateWeekdays(startDate, endDate);
    if (days.length === 0) return;
    const months = Array.from(new Set(days.map(d => d.slice(0,7))));
    for (const month of months) {
      try {
        const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
        const userCra = (cras || []).find((c: any) => (c as any).owner === ownerSub);
        if (!userCra) continue;
        const craId = (userCra as any).id as string;
        const { data: allEntries } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
        const toDelete = ((allEntries || []) as any[]).filter(e => {
          const inRange = days.includes((e as any).date);
          if (!inRange) return false;
          if (leaveId) return String((e as any).sourceType || '') === 'leave' && String((e as any).sourceId || '') === String(leaveId);
          return String((e as any).comment || '').includes('[CONGE]');
        });
        if (toDelete.length > 0) {
          await Promise.all(toDelete.map((e:any) => client.models.CraEntry.delete({ id: (e as any).id })));
        }
        try { await client.models.Cra.update({ id: craId, status: 'saved' as any }); } catch {}
      } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined') { try { window.dispatchEvent(new Event('cra:entries-updated')); } catch {} }
  };

  const updateStatus = async (
    id: string,
    status: 'pending' | 'approuvee' | 'refusee',
    adminNote?: string,
    owner?: string | null,
    req?: { startDate: string; endDate: string; reason?: string }
  ) => {
    try {
      await client.models.LeaveRequest.update({
        id,
        status: status as any,
        adminNote,
        userRead: false as any,
        userHidden: false as any,
        ...(owner ? { owner } as any : {}),
      });
      if (status === 'approuvee' && owner && req) {
        const note = (req && (req.reason || '')) || (adminNote || '');
        await applyApprovedLeaveToCra(owner, req.startDate, req.endDate, note, id);
      }
    } catch {}
  };

  const filtered = useMemo(() => {
    const byStatus = statusFilter === 'all' ? list : list.filter(lr => (lr as any).status === statusFilter);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    return byStatus.filter(lr => {
      const t = `${lr.startDate} ${lr.endDate} ${(lr as any).reason || ''} ${(lr as any).absenceType || ''}`.toLowerCase();
      return t.includes(q);
    }).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  }, [list, statusFilter, query]);

  // Helpers d'affichage des dates (FR)
  const formatDateFr = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  };
  const formatRangeFr = (a: string, b: string) => `${formatDateFr(a)} → ${formatDateFr(b)}`;

  if (isAdmin === null) return <Box sx={{ p: 4 }}><Typography>Chargement…</Typography></Box>;
  if (!isAdmin) return <Box sx={{ p: 4 }}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#894991', mb: 2 }}>Gestion des absences</Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <FormControl size="small" fullWidth>
            <InputLabel id="status-filter">Filtrer par statut</InputLabel>
            <Select labelId="status-filter" label="Filtrer par statut" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as FilterStatus)}>
              <MenuItem value={'pending'}>En attente</MenuItem>
              <MenuItem value={'approuvee'}>Validées</MenuItem>
              <MenuItem value={'refusee'}>Refusées</MenuItem>
              <MenuItem value={'all'}>Tous</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField size="small" fullWidth placeholder="Rechercher (date, motif, type)" value={query} onChange={(e)=>setQuery(e.target.value)} />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        {filtered.map(lr => {
          const status = (lr as any).status as string;
          const type = (lr as any).absenceType as string | undefined;
          const attachmentKey = (lr as any).attachmentKey as string | undefined;
          const attachmentIdentityId = (lr as any).attachmentIdentityId as string | undefined;
          const owner = (lr as any).owner as string | undefined;
          const ownerName = owner ? userNameMap[owner] : undefined;
          return (
            <Grid item xs={12} md={6} key={lr.id}>
              <Card elevation={0} sx={{
                border: '1px solid #ececec',
                borderRadius: 2,
                background: 'linear-gradient(180deg, #fff 0%, #fafafa 100%)',
                transition: 'box-shadow 0.2s ease, transform 0.1s ease',
                '&:hover': { boxShadow: '0 6px 16px rgba(0,0,0,0.08)', transform: 'translateY(-1px)' },
                borderLeft: `4px solid ${status === 'approuvee' ? '#2e7d32' : status === 'pending' ? '#ed6c02' : '#6c757d'}`,
              }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                      {ownerName && (ownerName.given || ownerName.family) && (
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1f2937', lineHeight: 1.2 }}>
                          {[ownerName.given, ownerName.family].filter(Boolean).join(' ')}
                        </Typography>
                      )}
                      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ color: '#374151' }}>
                        <CalendarMonthOutlinedIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatRangeFr(lr.startDate, lr.endDate)}
                        </Typography>
                        <Chip size="small" variant="outlined" label={`${enumerateWeekdays(lr.startDate, lr.endDate).length} jour${enumerateWeekdays(lr.startDate, lr.endDate).length>1?'s':''} ouvré${enumerateWeekdays(lr.startDate, lr.endDate).length>1?'s':''}`} />
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {type && <Chip size="small" label={type === 'conge' ? 'Congés' : type === 'maladie' ? 'Congé maladie' : 'Temps universitaire'} />}
                        <Chip size="small" color={status === 'pending' ? 'warning' : status === 'approuvee' ? 'success' : 'default'} label={status === 'pending' ? 'En attente' : status === 'approuvee' ? 'Validée' : 'Refusée'} />
                      </Stack>
                      {lr.reason && <Typography variant="body2" sx={{ color: '#4b5563' }}>{lr.reason}</Typography>}
                      {(lr as any).adminNote && <Typography variant="body2" sx={{ color: '#374151' }}>Note admin: {(lr as any).adminNote}</Typography>}
                      {attachmentKey && (
                        <Box sx={{ mt: 0.5 }}>
                          <MuiLink href={`#`} onClick={async (e)=>{
                            e.preventDefault();
                            try {
                              const { url } = await getUrl({
                                key: (attachmentKey || ''),
                                options: {
                                  accessLevel: 'protected',
                                  targetIdentityId: attachmentIdentityId,
                                  validateObjectExistence: true,
                                  expiresIn: 300,
                                }
                              } as any);
                              window.open(url.toString(), '_blank');
                            } catch (err) {
                              try {
                                const { url } = await getUrl({
                                  key: (attachmentKey || ''),
                                  options: {
                                    accessLevel: 'protected',
                                    validateObjectExistence: true,
                                    expiresIn: 300,
                                  }
                                } as any);
                                window.open(url.toString(), '_blank');
                              } catch {
                                alert('Pièce jointe introuvable ou accès refusé.');
                              }
                            }
                          }} underline="hover">
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <DownloadOutlinedIcon fontSize="small" />
                              <span>Télécharger la pièce jointe</span>
                            </Stack>
                          </MuiLink>
                        </Box>
                      )}
                    </Stack>
                    {status === 'pending' && (
                      <Stack spacing={1}>
                        <Tooltip title="Valider">
                          <span>
                            <IconButton color="success" onClick={()=>{ setSelected(lr); setTargetStatus('approuvee'); setNoteText(''); setConfirmOpen(true); }}>
                              <CheckCircleOutlineIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Refuser">
                          <span>
                            <IconButton color="default" onClick={()=>{ setSelected(lr); setTargetStatus('refusee'); setNoteText(''); setConfirmOpen(true); }}>
                              <CancelOutlinedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    )}
                    {status === 'approuvee' && (
                      <Stack spacing={1}>
                        <Tooltip title="Révoquer la validation">
                          <span>
                            <IconButton color="warning" onClick={()=>{ setSelected(lr); setRevokeOpen(true); }} disabled={revoking && revokingId === lr.id}>
                              {revoking && revokingId === lr.id ? <CircularProgress size={20} /> : <UndoOutlinedIcon />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    )}
                    {status === 'refusee' && (
                      <Stack spacing={1}>
                        <Tooltip title="Révoquer le refus">
                          <span>
                            <IconButton color="warning" onClick={()=>{ setSelected(lr); setRevokeOpen(true); }} disabled={revoking && revokingId === lr.id}>
                              {revoking && revokingId === lr.id ? <CircularProgress size={20} /> : <UndoOutlinedIcon />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        {statusFilter === 'refusee' && (
                          <Tooltip title="Supprimer la demande">
                            <span>
                              <IconButton color="default" onClick={async ()=>{
                                try {
                                  await client.models.LeaveRequest.delete({ id: lr.id });
                                  await load();
                                } catch {}
                              }}>
                                <DeleteOutlineIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        {filtered.length === 0 && (
          <Grid item xs={12}><Typography sx={{ color: '#777' }}>Aucune demande.</Typography></Grid>
        )}
      </Grid>

      <Dialog open={confirmOpen} onClose={()=>!confirmLoading && setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{targetStatus === 'approuvee' ? 'Valider la demande' : 'Refuser la demande'}</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth label="Note administrateur (optionnel)" value={noteText} onChange={(e)=>setNoteText(e.target.value)} multiline rows={3} />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setConfirmOpen(false)} disabled={confirmLoading}>Annuler</Button>
          <Button variant="contained" disabled={confirmLoading} onClick={async ()=>{
            if (!selected || !targetStatus) return;
            setConfirmLoading(true);
            try {
              const owner = (selected as any).owner as string | undefined;
              await updateStatus(selected.id, targetStatus as any, noteText || undefined, owner, { startDate: selected.startDate, endDate: selected.endDate, reason: (selected as any).reason });
              setSnackbar({ open: true, message: targetStatus === 'approuvee' ? 'Demande validée' : 'Demande refusée', severity: 'success' });
              setConfirmOpen(false);
              setSelected(null);
              setTargetStatus(null);
              setNoteText('');
              await load();
            } catch {
              setSnackbar({ open: true, message: 'Action échouée', severity: 'error' });
            } finally {
              setConfirmLoading(false);
            }
          }} sx={{ textTransform:'none', background:'#894991', '&:hover':{ background:'#6a3a7a' }}}>
            {confirmLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : (targetStatus === 'approuvee' ? 'Valider' : 'Refuser')}
          </Button>
        </DialogActions>
      </Dialog>

        {/* Details dialog (auto-openable via ?request=) */}
        <Dialog open={detailsOpen} onClose={()=>setDetailsOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Détails de la demande</DialogTitle>
          <DialogContent dividers>
            {selected && (
              <Box sx={{ display:'flex', flexDirection:'column', gap: 1 }}>
                <Typography><strong>Demandeur:</strong> {selected && userNameMap[(selected as any).owner] ? `${userNameMap[(selected as any).owner].given} ${userNameMap[(selected as any).owner].family}` : ((selected as any).owner || '').slice(0,10)}</Typography>
                <Typography><strong>Période:</strong> {formatRangeFr(selected.startDate, selected.endDate)}</Typography>
                {(selected as any).reason && <Typography><strong>Motif (utilisateur):</strong> {(selected as any).reason}</Typography>}
                {(selected as any).adminNote && <Typography><strong>Note admin:</strong> {(selected as any).adminNote}</Typography>}
                <TextField
                  label="Motif (optionnel) communiqué à l'utilisateur"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>setDetailsOpen(false)} disabled={detailsLoading!=null}>Annuler</Button>
            <Button color="error" variant="outlined" onClick={async ()=>{
              if (!selected) return;
              setDetailsLoading('refusee');
              try {
                await updateStatus(selected.id, 'refusee', noteText || undefined, (selected as any).owner, { startDate: selected.startDate, endDate: selected.endDate, reason: (selected as any).reason });
                setSnackbar({ open: true, message: 'Demande refusée', severity: 'success' });
                setDetailsOpen(false);
                setSelected(null);
                await load();
              } catch { setSnackbar({ open: true, message: 'Action échouée', severity: 'error' }); }
              finally { setDetailsLoading(null); }
            }} disabled={detailsLoading!=null}>
              {detailsLoading === 'refusee' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : 'Refuser'}
            </Button>
            <Button color="success" variant="contained" onClick={async ()=>{
              if (!selected) return;
              setDetailsLoading('approuvee');
              try {
                await updateStatus(selected.id, 'approuvee', noteText || undefined, (selected as any).owner, { startDate: selected.startDate, endDate: selected.endDate, reason: (selected as any).reason });
                setSnackbar({ open: true, message: 'Demande validée', severity: 'success' });
                setDetailsOpen(false);
                setSelected(null);
                await load();
              } catch { setSnackbar({ open: true, message: 'Action échouée', severity: 'error' }); }
              finally { setDetailsLoading(null); }
            }} disabled={detailsLoading!=null}>
              {detailsLoading === 'approuvee' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : 'Valider'}
            </Button>
          </DialogActions>
        </Dialog>

      {/* Révocation: confirmation + loader + snackbar */}
      <Dialog open={revokeOpen} onClose={()=>!revoking && setRevokeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Révoquer la validation</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {selected && (selected as any).status === 'approuvee'
              ? 'Confirmez-vous la révocation de cette demande validée ? Les écritures CRA associées seront retirées.'
              : 'Confirmez-vous la révocation de ce refus ? La demande repassera en attente.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setRevokeOpen(false)} disabled={revoking}>Annuler</Button>
          <Button variant="contained" color="warning" disabled={revoking} onClick={async ()=>{
            if (!selected) return;
            setRevoking(true);
            setRevokingId(selected.id);
            try {
              const currentStatus = (selected as any).status as string | undefined;
              const ownerSub = (selected as any).owner as string | undefined;
              if (currentStatus === 'approuvee') {
                if (ownerSub) { await removeApprovedLeaveFromCra(ownerSub, selected.startDate, selected.endDate, selected.id); }
              }
              await updateStatus(selected.id, 'pending', undefined, ownerSub as any, { startDate: selected.startDate, endDate: selected.endDate, reason: (selected as any).reason });
              setSnackbar({ open: true, message: currentStatus === 'approuvee' ? 'Révocation effectuée' : 'Refus révoqué', severity: 'success' });
              setRevokeOpen(false);
              setSelected(null);
              await load();
            } catch {
              setSnackbar({ open: true, message: 'Échec de la révocation', severity: 'error' });
            } finally {
              setRevoking(false);
              setRevokingId(null);
            }
          }}>
            {revoking ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Révoquer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={()=>setSnackbar(s=>({ ...s, open:false }))} anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({ ...s, open:false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AdminAbsencesPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}><Typography>Chargement…</Typography></Box>}>
      <AdminAbsencesPageInner />
    </Suspense>
  );
}
