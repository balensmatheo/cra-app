"use client";

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Typography, TextField, InputAdornment, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, Button, Skeleton, Checkbox, FormControl, InputLabel, Select, MenuItem, Snackbar, Alert } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { exportExcel } from '@/utils/exportExcel';

const client = generateClient<Schema>();

type Row = { id: string; owner?: string | null; month: string; status: string; isSubmitted?: boolean; entriesCount: number; updatedAt?: string | null };
type StatusFilter = 'submitted' | 'validated';

export default function AdminCraListPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
  });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, { given?: string; family?: string }>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('submitted');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success'|'error'|'info' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        setIsAdmin(!!groups?.includes('ADMINS'));
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  // Load Cognito users to resolve names once for display/export
  useEffect(() => {
    (async () => {
      if (!isAdmin) return;
      try {
        const { data, errors } = await client.queries.listUsers({});
        if (errors) throw new Error(errors[0]?.message || 'listUsers error');
        const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
        const users = (payload?.users || []) as any[];
        const map: Record<string, { given?: string; family?: string }> = {};
        users.forEach(u => {
          map[u.username] = { given: u.given_name, family: u.family_name };
        });
        setNameMap(map);
      } catch {
        // ignore; fallback to sub
      }
    })();
  }, [isAdmin]);

  const load = async (m: string) => {
    setLoading(true);
    try {
      // Fetch all CRAs of the month, we'll filter client-side by statusFilter
      const { data } = await client.models.Cra.list({ filter: { month: { eq: m } } });
      let list: Row[] = (data || []).map(c => ({
        id: c.id,
        owner: (c as any).owner,
        month: c.month || m,
        status: (c as any).status || 'draft',
        isSubmitted: (c as any).isSubmitted as boolean | undefined,
        entriesCount: (c as any).entries?.length || 0,
        updatedAt: (c as any).updatedAt || null,
      }));
      // Filter by status
      if (statusFilter === 'submitted') {
        list = list.filter(r => r.isSubmitted === true && r.status !== 'validated' && r.status !== 'closed');
      } else {
        list = list.filter(r => r.status === 'validated');
      }
      // Optionally compute entries count accurately by fetching entries for submitted items
      const needTotals = list.filter(r => r.entriesCount === 0);
      if (needTotals.length > 0) {
        const totals = await Promise.all(needTotals.map(async (r) => {
          try {
            const { data: ents } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: r.id } } });
            return [r.id, (ents || []).length] as const;
          } catch { return [r.id, 0] as const; }
        }));
        const map: Record<string, number> = {};
        totals.forEach(([id, n]) => { map[id] = n; });
        list = list.map(r => map[r.id] != null ? { ...r, entriesCount: map[r.id] } : r);
      }
      setRows(list);
      setSelectedIds({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(month); }, [isAdmin, month, statusFilter]);

  const fullName = (sub?: string | null) => {
    if (!sub) return '';
    const n = nameMap[sub];
    if (!n) return `${sub.slice(0, 10)}…`;
    const parts = [n.given, n.family].filter(Boolean);
    return parts.length ? parts.join(' ') : `${sub.slice(0, 10)}…`;
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const qq = norm(q);
    return rows.filter(r => norm(`${fullName(r.owner)}`).includes(qq) || norm(r.month).includes(qq));
  }, [rows, q]);

  const prettyStatus = (r: Row) => {
    if (r.status === 'validated') return 'VALIDATED';
    if (r.isSubmitted && r.status !== 'validated' && r.status !== 'closed') return 'SUBMITTED';
    return (r.status || '').toUpperCase();
  };

  const statusColor = (r: Row): 'default'|'info'|'success'|'warning'|'secondary' => {
    if (r.status === 'validated') return 'success';
    if (r.isSubmitted && r.status !== 'validated' && r.status !== 'closed') return 'warning';
    return 'default';
  };

  const allSelected = filtered.length > 0 && filtered.every(r => selectedIds[r.id]);
  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    filtered.forEach(r => { next[r.id] = checked; });
    setSelectedIds(next);
  };
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(prev => ({ ...prev, [id]: checked }));

  const validateOne = async (r: Row) => {
    try {
      await client.models.Cra.update({ id: r.id, status: 'validated' as any, isSubmitted: true as any });
      setSnackbar({ open: true, message: 'CRA validé', severity: 'success' });
      await load(month);
    } catch {
      setSnackbar({ open: true, message: "Échec de la validation", severity: 'error' });
    }
  };

  const validateSelected = async () => {
    const ids = Object.entries(selectedIds).filter(([,v]) => v).map(([id]) => id);
    if (ids.length === 0) return;
    let ok = 0, ko = 0;
    for (const id of ids) {
      try {
        await client.models.Cra.update({ id, status: 'validated' as any, isSubmitted: true as any });
        ok++;
      } catch { ko++; }
    }
    setSnackbar({ open: true, message: `Validation terminée: ${ok} succès, ${ko} échec(s)`, severity: ko ? 'error' : 'success' });
    await load(month);
  };

  if (isAdmin === null) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={220} height={36} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2, maxWidth: 320 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mois</TableCell>
              <TableCell>Utilisateur</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell align="right">Entrées</TableCell>
              <TableCell align="right">Ouvrir</TableCell>
              <TableCell align="right">Exporter</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton width={80} /></TableCell>
                <TableCell><Skeleton width={160} /></TableCell>
                <TableCell><Skeleton width={80} /></TableCell>
                <TableCell align="right"><Skeleton width={40} sx={{ ml: 'auto' }} /></TableCell>
                <TableCell align="right"><Skeleton width={48} sx={{ ml: 'auto' }} /></TableCell>
                <TableCell align="right"><Skeleton width={60} sx={{ ml: 'auto' }} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  }
  if (!isAdmin) {
    return <Box sx={{ p: 4 }}><Typography color="error">Accès refusé</Typography></Box>;
  }

  const buildDays = (m: string) => {
    const [yStr, mStr] = m.split('-');
    const y = Number(yStr);
    const mm = Number(mStr);
    const days: Date[] = [];
    const d = new Date(y, mm - 1, 1);
    while (d.getMonth() === mm - 1) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const handleExport = async (row: Row) => {
    try {
      // 1) Fetch entries for this CRA first
      const { data: ents } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: row.id } } });
      if (!ents || ents.length === 0) {
        console.warn('No entries found for CRA, skipping export');
        return;
      }

      type SecKey = 'facturees'|'non_facturees'|'autres';
      const usedCatIds = new Set<string>((ents as any[]).map(e => String(e.categoryId)));

      // 2) Fetch categories and keep only those used in this CRA
      const { data: cats } = await client.models.Category.list({});
      const byKindUsed: Record<SecKey, Array<{ id: string; label: string }>> = { facturees: [], non_facturees: [], autres: [] };
      (cats || []).forEach((c: any) => {
        if (!usedCatIds.has(c.id)) return;
        const kind = c.kind as 'facturee'|'non_facturee'|'autre' | undefined | null;
        const key: SecKey = kind === 'facturee' ? 'facturees' : kind === 'non_facturee' ? 'non_facturees' : 'autres';
        byKindUsed[key].push({ id: c.id, label: c.label || '' });
      });

      // 3) Build local numeric IDs for export utility and a reverse lookup map
      const localCats: Record<SecKey, Array<{ id: number; label: string }>> = { facturees: [], non_facturees: [], autres: [] };
      const origToLocal: Record<string, { sec: SecKey; localId: number }> = {};
      (Object.keys(byKindUsed) as SecKey[]).forEach((sec) => {
        const arr = byKindUsed[sec].slice().sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        arr.forEach((c, idx) => {
          const localId = idx + 1; // 1-based like row indices in template sections
          localCats[sec].push({ id: localId, label: c.label });
          origToLocal[c.id] = { sec, localId };
        });
      });
      // Build data map compatible with exportExcel
      const dataState: Record<SecKey, Record<number, Record<string, string> & { comment?: string }>> = {
        facturees: {}, non_facturees: {}, autres: {}
      };
      const commentByLocal: Record<string, string> = {};
      (ents || []).forEach((e: any) => {
        const origId = String(e.categoryId);
        const map = origToLocal[origId];
        if (!map) return; // category unknown (shouldn't happen)
        const date = e.date as string;
        const val = e.value as number;
        if (!dataState[map.sec][map.localId]) dataState[map.sec][map.localId] = {} as any;
        dataState[map.sec][map.localId][date] = String(val);
        if (e.comment && !commentByLocal[`${map.sec}:${map.localId}`]) commentByLocal[`${map.sec}:${map.localId}`] = e.comment as string;
      });
      // Attach comments
      Object.entries(commentByLocal).forEach(([k, comment]) => {
        const [sec, idStr] = k.split(':');
        const localId = Number(idStr);
        const s = sec as SecKey;
        if (!dataState[s][localId]) dataState[s][localId] = {} as any;
        dataState[s][localId].comment = comment;
      });

      const name = fullName(row.owner || undefined);
      const days = buildDays(row.month);
      const categories = localCats as any;
      await exportExcel({ name: name || 'Utilisateur', month: row.month, days, categories, data: dataState as any });
    } catch (e) {
      // Optionally, surface a toast in future
      console.error('Export Excel failed:', e);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color:'#894991' }}>CRA — Validation admin</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small">
            <InputLabel>Statut</InputLabel>
            <Select label="Statut" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as StatusFilter)} sx={{ minWidth: 160 }}>
              <MenuItem value="submitted">Soumis</MenuItem>
              <MenuItem value="validated">Validés</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="month"
            label="Mois"
            InputLabelProps={{ shrink: true }}
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          {statusFilter === 'submitted' && (
            <Button variant="contained" color="success" disabled={loading || filtered.length === 0} onClick={validateSelected} sx={{ textTransform: 'none' }}>Valider la sélection</Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display:'flex', alignItems:'center', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Rechercher (utilisateur, mois)"
          value={q}
          onChange={e => setQ(e.target.value)}
          InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small"><SearchIcon /></IconButton></InputAdornment> }}
        />
      </Box>

  <Table size="small">
        <TableHead>
          <TableRow>
            {statusFilter === 'submitted' && (
              <TableCell padding="checkbox">
                <Checkbox checked={allSelected} indeterminate={!allSelected && Object.values(selectedIds).some(Boolean)} onChange={(e)=>toggleAll(e.target.checked)} />
              </TableCell>
            )}
            <TableCell>Mois</TableCell>
            <TableCell>Utilisateur</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell align="right">Entrées</TableCell>
            <TableCell align="right">Aperçu</TableCell>
            <TableCell align="right">Exporter</TableCell>
            {statusFilter === 'submitted' && <TableCell align="right">Valider</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={160} /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell align="right"><Skeleton width={40} sx={{ ml: 'auto' }} /></TableCell>
                  <TableCell align="right"><Skeleton width={48} sx={{ ml: 'auto' }} /></TableCell>
                  <TableCell align="right"><Skeleton width={60} sx={{ ml: 'auto' }} /></TableCell>
                </TableRow>
              ))}
            </>
          )}
          {!loading && filtered.map(r => (
            <TableRow key={r.id} hover>
              {statusFilter === 'submitted' && (
                <TableCell padding="checkbox">
                  <Checkbox checked={!!selectedIds[r.id]} onChange={(e)=>toggleOne(r.id, e.target.checked)} />
                </TableCell>
              )}
              <TableCell>{r.month}</TableCell>
              <TableCell>{fullName(r.owner)}</TableCell>
              <TableCell><Chip size="small" label={prettyStatus(r)} color={statusColor(r) as any} /></TableCell>
              <TableCell align="right">{r.entriesCount}</TableCell>
              <TableCell align="right">
                <Typography
                  role="link"
                  tabIndex={0}
                  sx={{ color:'#894991', fontWeight:600, cursor:'pointer' }}
                  onClick={() => router.push(`/cra/${r.month}?user=${r.owner}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/cra/${r.month}?user=${r.owner}`); }}
                >Aperçu</Typography>
              </TableCell>
              <TableCell align="right">
                <Button size="small" variant="outlined" onClick={() => handleExport(r)}>Excel</Button>
              </TableCell>
              {statusFilter === 'submitted' && (
                <TableCell align="right">
                  <Button size="small" variant="contained" color="success" onClick={() => validateOne(r)} sx={{ textTransform: 'none' }}>Valider</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {filtered.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={statusFilter==='submitted'?7:6} align="center" sx={{ py: 4, color:'#777' }}>
                {statusFilter === 'submitted' ? 'Aucun CRA soumis pour ce mois' : 'Aucun CRA validé pour ce mois'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={()=>setSnackbar(s=>({ ...s, open:false }))} anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(s=>({ ...s, open:false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
