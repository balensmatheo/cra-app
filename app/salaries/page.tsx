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
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@/amplify/data/resource';
import { generateClient } from 'aws-amplify/data';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

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
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [mounted, setMounted] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newGroups, setNewGroups] = useState('USERS');
  const [newGroupsSel, setNewGroupsSel] = useState<string[]>(['USERS']);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{open:boolean; msg:string; sev:'success'|'error'|'info'}>({open:false,msg:'',sev:'success'});

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
      // Try protected listUsers to infer admin and populate
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
          setMeIsAdmin(true);
        }
      } catch (e) {
          console.error('[Salaries] listUsers failed:', e);
          // Fallback minimal: show only current user if we cannot list pool users
          if (mounted) setUsers(prev => prev.length ? prev : (meSub ? [{ sub: meSub, email: '', given_name: 'Moi', family_name: '', enabled: true, status: 'CONFIRMED', groups: meIsAdmin ? ['ADMINS'] : ['USERS'] }] : []));
          if (mounted) setMeIsAdmin(false);
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
    router.push(`/cra/${ym}?user=${encodeURIComponent(sub)}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:2, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#894991' }}>Salariés</Typography>
        {meIsAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={()=>setInviteOpen(true)} sx={{ bgcolor:'#894991', '&:hover':{ bgcolor:'#6a3a7a' }}}>Inviter un utilisateur</Button>
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
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
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
                p:2,
                borderRadius: 2,
                border: '1px solid #eee',
                background:'#fff',
                display:'flex',
                gap:2,
                alignItems:'center'
              }}>
                <Avatar sx={{ bgcolor:'#f0e6f2', color:'#894991', fontWeight:700 }}>{initials || 'U'}</Avatar>
                <Box sx={{ flex:1, minWidth:0 }}>
                  <Typography noWrap sx={{ fontWeight:600 }}>{name}</Typography>
                  <Typography variant="body2" noWrap color="text.secondary">{u.email}</Typography>
                  <Box sx={{ mt: 0.5, display:'flex', gap:1, flexWrap:'wrap' }}>
                    {isAdmin && <Chip size="small" label="Admin" color="secondary" variant="outlined" />}
                    {u.enabled === false && <Chip size="small" label="Désactivé" color="warning" variant="outlined" />}
                    {meIsAdmin && isPending && <Chip size="small" label="En attente" color="warning" />}
                    {meIsAdmin && isConfirmed && <Chip size="small" label="Validé" color="success" />}
                  </Box>
                </Box>
                <Box sx={{ display:'flex', gap:1 }}>
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
    </Box>
  );
}
