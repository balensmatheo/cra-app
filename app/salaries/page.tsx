"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Badge from '@mui/material/Badge';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { getUrl } from 'aws-amplify/storage';

type PoolUser = {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  enabled?: boolean;
  status?: string;
  groups?: string[];
};

export default function SalariesPage() {
  const router = useRouter();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const client = useMemo(() => generateClient<Schema>(), []);
  const [meIsAdmin, setMeIsAdmin] = useState(false);
  const [meSub, setMeSub] = useState<string | null>(null);
  const [users, setUsers] = useState<PoolUser[]>([]);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [mounted, setMounted] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newGroups, setNewGroups] = useState('USERS');
  const [newGroupsSel, setNewGroupsSel] = useState<string[]>(['USERS']);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{open:boolean; msg:string; sev:'success'|'error'|'info'}>({open:false,msg:'',sev:'success'});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PoolUser | null>(null);
  // Multi-select and actions
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionsEl, setActionsEl] = useState<null | HTMLElement>(null);
  const actionsOpen = Boolean(actionsEl);
  const openActions = (e: React.MouseEvent<HTMLButtonElement>) => setActionsEl(e.currentTarget);
  const closeActions = () => setActionsEl(null);
  const toggleSelected = (sub: string) => setSelected(prev => { const s = new Set(prev); if (s.has(sub)) s.delete(sub); else s.add(sub); return s; });
  const clearSelection = () => setSelected(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Render-only-on-client flag to prevent hydration mismatch from browser extensions injecting attributes
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await getCurrentUser();
        setMeSub((user as any)?.userId || null);
      } catch {}
      // Determine admin rights from token groups
      try {
        const { tokens } = await fetchAuthSession();
        const groups = (tokens?.idToken?.payload as any)?.['cognito:groups'] as string[] | undefined;
        if (mounted) setMeIsAdmin(Array.isArray(groups) && groups.includes('ADMINS'));
      } catch {}
      // List users (now allowed for USERS, too)
      try {
        const { data, errors } = await client.queries.listUsers({ search: q || undefined });
        console.log('[Salaries] listUsers result:', { data, errors });
        if (errors) throw new Error(errors[0]?.message || 'Erreur');
        const payload = typeof data === 'string' ? JSON.parse(data) : (data as any);
        const list = ((payload as any)?.users || []).map((u: any) => ({
            sub: u.username,
            email: u.email,
            given_name: u.given_name,
            family_name: u.family_name,
            enabled: u.enabled,
            status: u.status,
            groups: u.groups || [],
          } as PoolUser));
        console.table(list);
        if (mounted) {
          setUsers(list);
        }
        // Best-effort: resolve public avatars for these users
        try {
          const pairs = await Promise.all(list.map(async (u: PoolUser) => {
            const candidates = [`avatars/${u.sub}.jpg`, `avatars/${u.email?.split('@')[0] || ''}.jpg`].filter(Boolean);
            for (const key of candidates) {
              try {
                const { url } = await getUrl({ key, options: { accessLevel: 'guest', expiresIn: 300 } });
                return [u.sub, url.toString()] as const;
              } catch {}
            }
            return null;
          }));
          const amap: Record<string, string> = {};
          for (const p of pairs) if (p) amap[p[0]] = p[1];
          if (mounted && Object.keys(amap).length) setAvatarMap(prev => ({ ...prev, ...amap }));
        } catch {/* ignore */}
      } catch (e) {
        console.error('[Salaries] listUsers failed:', e);
        // Fallback minimal: show only current user if we cannot list pool users
        if (mounted) setUsers(prev => prev.length ? prev : (meSub ? [{ sub: meSub, email: '', given_name: 'Moi', family_name: '', enabled: true, status: 'CONFIRMED', groups: [] }] : []));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [q]);

  const filtered = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const query = norm(q);
    return users.filter(u => {
      const full = `${u.given_name || ''} ${u.family_name || ''} ${u.email || ''}`;
      return norm(full).includes(query);
    }).sort((a,b) => (a.family_name || a.email || '').localeCompare(b.family_name || b.email || ''));
  }, [users, q]);

  const goToCra = (sub: string, editable: boolean) => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
    const params = new URLSearchParams({ user: sub });
    if (editable) params.set('edit', '1');
    router.push(`/cra/${ym}?${params.toString()}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2, mb: 2, flexWrap:'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#894991' }}>Salariés</Typography>
        {meIsAdmin && (
          <Box sx={{ display:'flex', gap:1, alignItems:'center' }}>
            <Badge color="secondary" badgeContent={selected.size || null} overlap="circular">
              <Button
                variant="outlined"
                onClick={openActions}
                disabled={selected.size === 0}
                sx={{ textTransform:'none' }}
              >Actions</Button>
            </Badge>
            <Menu anchorEl={actionsEl} open={actionsOpen} onClose={closeActions} anchorOrigin={{ vertical:'bottom', horizontal:'left' }}>
              <MenuItem
                disabled={selected.size === 0}
                onClick={() => { closeActions(); setBatchDeleteOpen(true); }}
              >Supprimer l'utilisateur</MenuItem>
            </Menu>
            <Button variant="contained" startIcon={<AddIcon />} onClick={()=>setInviteOpen(true)} sx={{ bgcolor:'#894991', '&:hover':{ bgcolor:'#6a3a7a' }}}>Inviter un utilisateur</Button>
          </Box>
        )}
      </Box>
      <Box sx={{ display:'flex', alignItems:'center', gap:2, mb:2, flexWrap:'wrap' }}>
        {mounted ? (
          <TextField
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Rechercher par nom ou email"
            type="search"
            autoComplete="off"
            size="small"
            fullWidth
            sx={{ maxWidth: 520 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color:'#999' }}/></InputAdornment>,
              inputProps: {
                autoComplete: 'off',
                'data-1p-ignore': 'true',
                'data-lpignore': 'true',
                'data-form-type': 'other',
                spellCheck: false,
                autoCorrect: 'off',
              }
            }}
          />
        ) : (
          <Box sx={{ height: 40, maxWidth: 520, width: '100%', bgcolor: '#f5f5f5', borderRadius: 1 }} />
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ display:'flex', alignItems:'center', gap:1, color:'#666' }}>
          <CircularProgress size={18} /> Chargement des utilisateurs…
        </Box>
      ) : (
        <Box sx={{
          display:'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(420px, 1fr))' },
          gap: 2.5
        }}>
          {filtered.map(u => {
            const name = [u.given_name, u.family_name].filter(Boolean).join(' ') || u.email || u.sub;
            const initials = (u.given_name?.[0] || '') + (u.family_name?.[0] || '');
            const isAdmin = (u.groups || []).includes('ADMINS');
            const status = (u.status || '').toUpperCase();
            const isPending = status === 'UNCONFIRMED' || status === 'FORCE_CHANGE_PASSWORD' || status === 'RESET_REQUIRED';
            const isConfirmed = status === 'CONFIRMED';
            const canEdit = meIsAdmin; // only admins can edit CRA, others read-only
            return (
              <Box key={u.sub} sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid #eee',
                background: 'linear-gradient(180deg, #ffffff 0%, #fcfbfd 100%)',
                display: 'flex',
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                gap: 2.5,
                alignItems: 'center',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
                '&:hover': {
                  borderColor: '#e7dff0',
                  boxShadow: '0 8px 24px rgba(137,73,145,0.10)',
                  transform: 'translateY(-1px)'
                }
              }}>
                {meIsAdmin && (
                  <Checkbox
                    checked={selected.has(u.sub)}
                    onChange={() => toggleSelected(u.sub)}
                    size="small"
                    inputProps={{ 'aria-label': 'Sélectionner l\'utilisateur' }}
                  />
                )}
                <Avatar src={avatarMap[u.sub]} sx={{
                  bgcolor: 'transparent',
                  color: '#6a3a7a',
                  fontWeight: 700,
                  width: 48,
                  height: 48,
                  fontSize: 16,
                  background: 'linear-gradient(135deg, #f4e9f6 0%, #ece3f1 100%)',
                  border: '1px solid #efe7f3',
                  flexShrink: 0
                }}>
                  {initials || 'U'}
                </Avatar>
                <Box sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                  <Typography noWrap sx={{ fontWeight:800, color:'#3b1f46', letterSpacing: 0.2, fontSize: '1.05rem', maxWidth: '100%' }}>{name}</Typography>
                  <Typography variant="body2" noWrap color="text.secondary" sx={{ display: 'block', maxWidth: '100%' }}>{u.email}</Typography>
                  <Box sx={{ mt: 0.75, display:'flex', gap:1, flexWrap:'wrap' }}>
                    {isAdmin && <Chip size="small" label="Admin" color="secondary" variant="outlined" />}
                    {u.enabled === false && <Chip size="small" label="Désactivé" color="warning" variant="outlined" />}
                    {meIsAdmin && isPending && <Chip size="small" label="En attente" color="warning" />}
                    {meIsAdmin && isConfirmed && <Chip size="small" label="Validé" color="success" />}
                  </Box>
                </Box>
                <Box sx={{ display:'flex', gap:1, flexShrink: 0, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-end', sm: 'initial' }, mt: { xs: 1, sm: 0 } }}>
                  <IconButton size="small" onClick={()=>goToCra(u.sub, false)} title="Voir le CRA">
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  {meIsAdmin && (
                    <IconButton size="small" onClick={()=>goToCra(u.sub, true)} title="Ouvrir en édition (admin)">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
            );
          })}
          {filtered.length === 0 && (
            <Box sx={{ color:'#777' }}>Aucun utilisateur</Box>
          )}
        </Box>
      )}
      {/* Invite dialog (admin) */}
      {meIsAdmin && (
        <Dialog
          open={inviteOpen}
          onClose={()=>!creating && setInviteOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={fullScreen}
          PaperProps={{
            sx: {
              borderRadius: { xs: 0, sm: 3 },
              boxShadow: 24,
            }
          }}
        >
          <DialogTitle sx={{ pr: fullScreen ? 7 : 3 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
              <Box sx={{ width:36, height:36, borderRadius:'50%', background:'#f2e8f4', color:'#894991', display:'grid', placeItems:'center' }}>
                <PersonAddRoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight:700 }}>Inviter un utilisateur</Typography>
                <Typography variant="body2" color="text.secondary">Envoyez une invitation avec mot de passe temporaire</Typography>
              </Box>
            </Box>
            <IconButton
              onClick={()=>!creating && setInviteOpen(false)}
              sx={{ position:'absolute', right:8, top:8 }}
              size="small"
              aria-label="Fermer"
            >
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            <Box sx={{ display:'flex', flexDirection:'column', gap:1.25 }}>
              <TextField
                label="Adresse email"
                type="email"
                size="small"
                value={newEmail}
                onChange={e=>setNewEmail(e.target.value)}
                placeholder="email@domaine.com"
                fullWidth
                autoFocus
                margin="none"
                sx={{ mt: 1.5 }}
                error={!!newEmail && !validateEmail(newEmail)}
                helperText={!!newEmail && !validateEmail(newEmail) ? 'Adresse email invalide' : ' '}
              />
              <Autocomplete
                multiple
                freeSolo
                options={['USERS','ADMINS']}
                value={newGroupsSel}
                onChange={(_, value) => {
                  setNewGroupsSel(value as string[]);
                  setNewGroups((value as string[]).join(', '));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Groupes"
                    placeholder="USERS, ADMINS"
                    helperText="Choisissez ou saisissez des groupes (séparés par virgules)"
                    size="small"
                    margin="none"
                    fullWidth
                  />
                )}
              />
              <Box sx={{
                p:1.5,
                borderRadius:2,
                bgcolor:'#f9f2fb',
                color:'#6a3a7a',
                border:'1px solid #f0e6f4'
              }}>
                <Typography variant="body2">
                  Un email d'invitation sera envoyé par Cognito avec un mot de passe temporaire.
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
            <Button onClick={()=>setInviteOpen(false)} disabled={creating} sx={{ color:'#894991' }} fullWidth={fullScreen}>Annuler</Button>
            <Button
              variant="contained"
              startIcon={!creating ? <PersonAddRoundedIcon /> : undefined}
              disabled={creating || !validateEmail(newEmail)}
              onClick={async ()=>{
                setCreating(true);
                try {
                  const candidates = newGroupsSel && newGroupsSel.length
                    ? newGroupsSel
                    : newGroups.split(',').map(s=>s.trim()).filter(Boolean);
                  const groups = Array.from(new Set(candidates));
                  const { data, errors } = await client.mutations.createUser({ email: newEmail, groups });
                  if (errors) throw new Error(errors[0]?.message || 'Erreur');
                  setToast({open:true, msg:'Utilisateur créé. Invitation envoyée.', sev:'success'});
                  setNewEmail('');
                  setNewGroups('USERS');
                  setNewGroupsSel(['USERS']);
                  setInviteOpen(false);
                  // Refresh list
                  try {
                    const { data, errors } = await client.queries.listUsers({});
                    console.log('[Salaries] listUsers after create:', { data, errors });
                    const payload2 = typeof data === 'string' ? JSON.parse(data) : (data as any);
                    const list = (((payload2 as any)?.users) || []).map((u: any) => ({
                      sub: u.username,
                      email: u.email,
                      given_name: u.given_name,
                      family_name: u.family_name,
                      enabled: u.enabled,
                      status: u.status,
                      groups: u.groups || [],
                    } as PoolUser));
                    console.table(list);
                    setUsers(list);
                  } catch (e) {
                    console.error('[Salaries] listUsers after create failed:', e);
                  }
                } catch(e:any) {
                  setToast({open:true, msg:e?.message || 'Erreur', sev:'error'});
                } finally { setCreating(false); }
              }}
              sx={{ bgcolor:'#894991', '&:hover':{ bgcolor:'#6a3a7a' }}}
              fullWidth={fullScreen}
            >
              {creating ? <CircularProgress size={20} sx={{ color:'#fff' }} /> : 'Inviter'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Snackbar open={toast.open} autoHideDuration={4000} onClose={()=>setToast(s=>({...s,open:false}))}>
        <Alert severity={toast.sev} onClose={()=>setToast(s=>({...s,open:false}))}>{toast.msg}</Alert>
      </Snackbar>

      {/* Delete confirmation dialog (admin) */}
      {meIsAdmin && (
        <Dialog
          open={deleteOpen}
          onClose={()=>!deleting && setDeleteOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Supprimer l'utilisateur ?</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Cette action est irréversible et supprimera le compte de l'utilisateur sélectionné.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vous ne pouvez pas supprimer un administrateur ni votre propre compte via cette interface.
            </Typography>
            {deleteTarget && (
              <Box sx={{ mt: 1.5, p:1.25, border:'1px solid #eee', borderRadius:1 }}>
                <Typography variant="body2" sx={{ fontWeight:600 }}>
                  {(deleteTarget.given_name||'') + ' ' + (deleteTarget.family_name||'') || deleteTarget.email || deleteTarget.sub}
                </Typography>
                <Typography variant="caption" color="text.secondary">{deleteTarget.email}</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>setDeleteOpen(false)} disabled={deleting}>Annuler</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deleting || !deleteTarget}
              onClick={async ()=>{
                if (!deleteTarget) return;
                setDeleting(true);
                try {
                  const { data, errors } = await client.mutations.deleteUser({ sub: deleteTarget.sub });
                  if (errors) throw new Error(errors[0]?.message || 'Erreur suppression');
                  const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
                  if (payload?.ok && payload?.deleted) {
                    setToast({ open:true, msg:"Utilisateur supprimé", sev:'success' });
                  } else if (payload?.ok && payload?.reason === 'not_found') {
                    setToast({ open:true, msg:"Utilisateur introuvable (déjà supprimé)", sev:'info' });
                  } else if (payload?.reason === 'target_is_admin') {
                    setToast({ open:true, msg:"Impossible de supprimer un administrateur", sev:'error' });
                  } else if (payload?.reason === 'cannot_delete_self') {
                    setToast({ open:true, msg:"Vous ne pouvez pas supprimer votre propre compte", sev:'error' });
                  } else {
                    setToast({ open:true, msg:"Suppression impossible", sev:'error' });
                  }
                  setDeleteOpen(false);
                  setDeleteTarget(null);
                  // Refresh list
                  try {
                    const { data: data2, errors: err2 } = await client.queries.listUsers({ search: q || undefined });
                    if (!err2) {
                      const payload2 = typeof data2 === 'string' ? JSON.parse(data2 as any) : (data2 as any);
                      const list = (((payload2 as any)?.users) || []).map((u: any) => ({
                        sub: u.username,
                        email: u.email,
                        given_name: u.given_name,
                        family_name: u.family_name,
                        enabled: u.enabled,
                        status: u.status,
                        groups: u.groups || [],
                      } as PoolUser));
                      setUsers(list);
                    }
                  } catch {}
                } catch (e:any) {
                  setToast({ open:true, msg:e?.message || 'Erreur suppression', sev:'error' });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <CircularProgress size={18} sx={{ color:'#fff' }} /> : 'Supprimer'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Batch delete confirmation */}
      {meIsAdmin && (
        <Dialog open={batchDeleteOpen} onClose={()=>!batchDeleting && setBatchDeleteOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Supprimer {selected.size} utilisateur(s) ?</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Cette action est irréversible et supprimera le(s) compte(s) sélectionné(s).
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Les administrateurs et votre propre compte seront ignorés.
            </Typography>
            <Box sx={{ mt: 1.5, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:1 }}>
              {Array.from(selected).map(sub => {
                const u = users.find(x => x.sub === sub);
                if (!u) return null;
                const name = [u.given_name, u.family_name].filter(Boolean).join(' ') || u.email || u.sub;
                const admin = (u.groups || []).includes('ADMINS');
                const self = meSub && meSub === u.sub;
                return (
                  <Box key={sub} sx={{ p:1, border:'1px solid #eee', borderRadius:1, opacity: admin || self ? 0.6 : 1 }}>
                    <Typography variant="body2" sx={{ fontWeight:600 }}>{name}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    {(admin || self) && (
                      <Typography variant="caption" color="error" sx={{ display:'block' }}>
                        {admin ? 'Admin - ignoré' : 'Votre compte - ignoré'}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>setBatchDeleteOpen(false)} disabled={batchDeleting}>Annuler</Button>
            <Button
              color="error"
              variant="contained"
              disabled={batchDeleting || selected.size === 0}
              onClick={async ()=>{
                setBatchDeleting(true);
                try {
                  const subs = Array.from(selected);
                  const targets = subs
                    .map(s => users.find(u => u.sub === s))
                    .filter((u): u is PoolUser => !!u)
                    .filter(u => !(u.groups || []).includes('ADMINS'))
                    .filter(u => u.sub !== meSub);
                  const results = await Promise.allSettled(targets.map(async (u) => {
                    const { data, errors } = await client.mutations.deleteUser({ sub: u.sub });
                    const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
                    return { u, errors, payload };
                  }));
                  const deleted = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.payload?.ok && (r.value as any)?.payload?.deleted).length;
                  const skipped = subs.length - targets.length;
                  const failures = results.filter(r => r.status === 'rejected' || (r as any)?.value?.payload?.ok === false).length;
                  if (deleted > 0 && failures === 0) {
                    setToast({ open:true, msg: `${deleted} utilisateur(s) supprimé(s)`, sev:'success' });
                  } else if (deleted > 0 && failures > 0) {
                    setToast({ open:true, msg: `${deleted} supprimé(s), ${failures} échec(s)`, sev:'info' });
                  } else if (deleted === 0 && failures > 0) {
                    setToast({ open:true, msg: `Aucune suppression. ${failures} échec(s)`, sev:'error' });
                  } else {
                    setToast({ open:true, msg: `Aucune suppression effectuée`, sev:'info' });
                  }
                  setBatchDeleteOpen(false);
                  clearSelection();
                  // Refresh list
                  try {
                    const { data: data2, errors: err2 } = await client.queries.listUsers({ search: q || undefined });
                    if (!err2) {
                      const payload2 = typeof data2 === 'string' ? JSON.parse(data2 as any) : (data2 as any);
                      const list = (((payload2 as any)?.users) || []).map((u: any) => ({
                        sub: u.username,
                        email: u.email,
                        given_name: u.given_name,
                        family_name: u.family_name,
                        enabled: u.enabled,
                        status: u.status,
                        groups: u.groups || [],
                      } as PoolUser));
                      setUsers(list);
                    }
                  } catch {}
                } catch (e:any) {
                  setToast({ open:true, msg: e?.message || 'Erreur suppression', sev:'error' });
                } finally {
                  setBatchDeleting(false);
                }
              }}
            >
              {batchDeleting ? <CircularProgress size={18} sx={{ color:'#fff' }} /> : 'Supprimer'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
