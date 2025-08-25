"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type React from 'react';
import { Box, Typography, Card, CardMedia, CardContent, Chip, Skeleton, Select, MenuItem, FormControl, InputLabel, Button, Grid, Tooltip, Stack, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress } from '@mui/material';
import Link from 'next/link';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIconOutline from '@mui/icons-material/DeleteOutline';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { applySeminarToCra, removeSeminarFromCra, emitCraEntriesUpdated } from '@/utils/craSync';

const client = generateClient<Schema>();

type SeminarGroup = {
  startDate: string;
  endDate: string;
  title?: string;
  location?: string;
  activities?: string;
  details?: string;
  imageUrl?: string;
  myStatus?: 'pending' | 'accepted' | 'refused';
  myInviteId?: string | null;
  totalInvites: number;
  acceptedCount: number;
  refusedCount: number;
  pendingCount: number;
  invites: Array<{
    id: string;
    owner: string;
    status: 'pending' | 'accepted' | 'refused';
  }>;
  // Local-only flag to indicate an unsaved draft entry
  isDraft?: boolean;
};

export default function SeminairesPage() {
  const [seminars, setSeminars] = useState<SeminarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'past' | 'current' | 'upcoming'>('all');
  const [currentSub, setCurrentSub] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [nameMap, setNameMap] = useState<Record<string, { given?: string; family?: string }>>({});
  const [usersList, setUsersList] = useState<Array<{ username: string; given_name?: string; family_name?: string }>>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success'|'error'|'info' }>({ open: false, message: '', severity: 'success' });
  const [actionBusy, setActionBusy] = useState<string | null>(null); // key=start_end for action in progress
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Admin create seminar dialog state
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    startDate: string;
    endDate: string;
    location: string;
    activities: string;
    details: string;
    imageUrl: string; // S3 key or external URL
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
    loading: false,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState<boolean>(false);
  const [draftRev, setDraftRev] = useState<number>(0); // bump to refresh draft view
  const skipNextAutosaveRef = useRef<boolean>(false);
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const openEndPicker = useCallback(() => {
    const el = endDateRef.current as any;
    if (!el) return;
    try { el.focus(); } catch {}
    try { if (typeof el.showPicker === 'function') el.showPicker(); } catch {}
    try { el.click?.(); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const sub = session.tokens?.idToken?.payload.sub as string | undefined;
  const groups: string[] = (session.tokens?.idToken?.payload['cognito:groups'] as any) || [];
  setIsAdmin(groups.includes('ADMINS'));
  if (sub) setCurrentSub(sub);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    loadSeminars();
    loadUserNames();
  }, [currentSub]);

  const loadUserNames = async () => {
    try {
      const { data, errors } = await client.queries.listUsers({});
      if (!errors && data) {
        const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
        const users = (payload?.users || []) as any[];
        const map: Record<string, { given?: string; family?: string }> = {};
        users.forEach(u => {
          map[u.username] = { given: u.given_name, family: u.family_name };
        });
        setNameMap(map);
  setUsersList(users.map(u => ({ username: u.username, given_name: u.given_name, family_name: u.family_name })));
      }
    } catch (e) {
      console.error('Failed to load user names:', e);
    }
  };

  const getUserDisplayName = (sub?: string) => {
    if (!sub) return 'Utilisateur';
    const user = nameMap[sub];
    if (user) {
      const parts = [user.given, user.family].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : sub;
    }
    return sub;
  };

  const loadSeminars = async () => {
    if (!currentSub) return;
    try {
      setLoading(true);
      // Fetch all seminar invites
      const { data } = await (client.models.SeminarInvite.list as any)({});
      const invites = (data || []) as any[];

      // Group by date range
      const grouped: Record<string, any[]> = {};
      invites.forEach(inv => {
        const key = `${inv.startDate}_${inv.endDate}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(inv);
      });

      // Build seminar groups
      const groups: SeminarGroup[] = Object.entries(grouped).map(([key, invs]) => {
        const [startDate, endDate] = key.split('_');
        const myInvite = invs.find(i => i.owner === currentSub);
        const first = invs[0]; // Use first invite for common data

        return {
          startDate,
          endDate,
          title: first.title,
          location: first.location,
          activities: first.activities,
          details: first.details,
          imageUrl: first.imageUrl,
          myStatus: myInvite?.status,
          myInviteId: myInvite?.id ?? null,
          totalInvites: invs.length,
          acceptedCount: invs.filter(i => i.status === 'accepted').length,
          refusedCount: invs.filter(i => i.status === 'refused').length,
          pendingCount: invs.filter(i => i.status === 'pending').length,
          invites: invs.map(inv => ({
            id: inv.id,
            owner: inv.owner,
            status: inv.status || 'pending'
          }))
        };
      });

      setSeminars(groups.sort((a, b) => b.startDate.localeCompare(a.startDate)));
    } catch (err) {
      console.error('Failed to load seminars:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Draft helpers ---
  const draftKey = useMemo(() => `seminarDraft:${currentSub || 'me'}`, [currentSub]);

  const loadDraftIfAny = useCallback(async () => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
      if (!raw) return false;
      const d = JSON.parse(raw || '{}');
      // Basic shape validation
      if (!d || typeof d !== 'object') return false;
      // Load dialog state
      setCreateDialog(prev => ({
        ...prev,
        startDate: d.startDate || '',
        endDate: d.endDate || '',
        location: d.location || '',
        activities: d.activities || '',
        details: d.details || '',
        imageUrl: d.imageUrl || '',
        scope: d.scope === 'user' ? 'user' : 'global',
        userId: d.userId || null,
        open: true,
      }));
      setDraftLoaded(true);
      // If there is an S3 key, fetch a temporary URL for preview
      if (d.imageUrl && typeof d.imageUrl === 'string') {
        try {
          const { url } = await getUrl({ path: d.imageUrl, options: { expiresIn: 300 } });
          setImagePreview(url.toString());
        } catch {
          // ignore preview failures
        }
      }
      // Avoid immediate autosave right after loading
      skipNextAutosaveRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    try { if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey); } catch {}
    setDraftLoaded(false);
  setDraftRev(v => v + 1);
  }, [draftKey]);

  const autosaveDraft = useCallback((state: typeof createDialog) => {
    try {
      // Do not autosave when dialog is closed
      if (!state.open) return;
      const { startDate, endDate, location, activities, details, imageUrl, scope, userId } = state;
      const hasContent = !!(startDate || endDate || location || activities || details || imageUrl || (scope === 'user' && userId));
      if (!hasContent) {
        // If everything empty, clear draft
        clearDraft();
        return;
      }
      const payload = { startDate, endDate, location, activities, details, imageUrl, scope, userId };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
      }
  setDraftRev(v => v + 1);
    } catch {
      // ignore
    }
  }, [clearDraft, draftKey]);

  // Drag & drop / file selection handler for image upload (accepts FileList or single File)
  const handleImageFiles = async (files: FileList | File | null) => {
    if (!files) return;
    const file = (files instanceof File) ? files : files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: 'Le fichier doit être une image', severity: 'error' });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setUploading(true);
    setUploadProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
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
      setCreateDialog(prev => ({ ...prev, imageUrl: key }));
  // Also autosave the draft right away with new image key
  autosaveDraft({ ...createDialog, imageUrl: key, open: true });
      setSnackbar({ open: true, message: 'Image téléchargée avec succès', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, message: "Échec de l'upload de l'image", severity: 'error' });
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  // Core paste handler that accepts DataTransfer from either DOM or React paste events
  const handlePasteFromData = async (dt: DataTransfer | null) => {
    if (!dt) return;
    try {
      // 1) Image file directly present
      if (dt.files && dt.files.length) {
        const file = Array.from(dt.files).find(f => f.type?.startsWith('image/'));
        if (file) {
          await handleImageFiles(file);
          return;
        }
      }
      // 2) Scan items for an image blob
      const items = dt.items ? Array.from(dt.items) : [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) {
            const ext = (blob.type.split('/')[1] || 'png');
            const file = new File([blob], `pasted.${ext}`, { type: blob.type });
            await handleImageFiles(file);
            return;
          }
        }
      }
      // 3) Fallback: text content that might be an image URL
      const textData = dt.getData('text') || dt.getData('text/plain') || '';
      const url = textData.trim();
      if (url && /^https?:\/\//i.test(url)) {
        // Accept as URL; if it's an image, preview will render. If not, the preview may fail to load.
        setImagePreview(url);
        setCreateDialog(prev => ({ ...prev, imageUrl: url }));
        // Immediate draft update to persist the pasted URL
        autosaveDraft({ ...createDialog, imageUrl: url, open: true });
        setSnackbar({ open: true, message: 'Image collée depuis une URL', severity: 'success' });
        return;
      }
    } catch {
      // ignore
    }
  };

  // React onPaste wrapper for the dropzone
  const handlePasteImage = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    await handlePasteFromData(e.clipboardData);
    // Prevent default if we handled anything meaningful (best-effort)
    if (e.clipboardData && (e.clipboardData.files?.length || e.clipboardData.getData('text'))) {
      e.preventDefault();
    }
  };

  const createSeminar = async () => {
    const { startDate, endDate, location, activities, details, imageUrl, scope, userId } = createDialog;
    if (!startDate || !endDate) {
      setSnackbar({ open: true, message: 'Sélectionnez une période (début et fin)', severity: 'error' });
      return;
    }
    if (startDate > endDate) {
      setSnackbar({ open: true, message: 'La date de début doit précéder la date de fin', severity: 'error' });
      return;
    }
    if (scope === 'user' && !userId) {
      setSnackbar({ open: true, message: 'Sélectionnez un utilisateur', severity: 'error' });
      return;
    }

    setCreateDialog(prev => ({ ...prev, loading: true }));
    try {
      // Enumerate days inclusive in UTC
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

      // Create SpecialDay entries
      for (const date of dates) {
        await client.models.SpecialDay.create({
          date,
          type: 'seminaire' as any,
          scope: scope as any,
          userId: scope === 'user' ? (userId as any) : undefined,
        } as any);
      }

      // Create SeminarInvite entries
      const targets: string[] = scope === 'user' && userId ? [userId] : usersList.map(u => u.username);
      for (const sub of targets) {
        try {
          await (client.models.SeminarInvite.create as any)({
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
        } catch (err) {
          console.error('Failed to create invite for', sub, err);
        }
      }

  // Clear any saved draft upon success
  clearDraft();
  setCreateDialog({
        open: false,
        startDate: '',
        endDate: '',
        location: '',
        activities: '',
        details: '',
        imageUrl: '',
        scope: 'global',
        userId: null,
        loading: false,
      });
      setImagePreview(null);
      setUploadProgress(0);
      setSnackbar({ open: true, message: `Séminaire créé (${dates.length} jour${dates.length > 1 ? 's' : ''})`, severity: 'success' });
      await loadSeminars();
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, message: 'Erreur lors de la création du séminaire', severity: 'error' });
    } finally {
      setCreateDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const isHttpUrl = (u?: string) => !!u && /^https?:\/\//i.test(u);

  // Resolve S3 keys to signed URLs and cache per group (start_end)
  useEffect(() => {
    if (!seminars.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        seminars.map(async (sem) => {
          const groupKey = `${sem.startDate}_${sem.endDate}`;
          const img = sem.imageUrl?.trim();
          if (!img || isHttpUrl(img) || imageUrls[groupKey]) return null;
          try {
            const { url } = await getUrl({
              path: img,
              options: {
                // Ensure object exists; otherwise we'll skip and render placeholder
                validateObjectExistence: true,
              },
            });
            return [groupKey, url.toString()] as const;
          } catch (e) {
            console.warn('Failed to resolve image URL for', img, e);
            return null;
          }
        })
      );
      if (cancelled) return;
      const updates: Record<string, string> = {};
      for (const pair of entries) {
        if (pair) updates[pair[0]] = pair[1];
      }
      if (Object.keys(updates).length) {
        setImageUrls((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seminars]);

  const filteredSeminars = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return seminars.filter(sem => {
      switch (filter) {
        case 'past':
          return sem.endDate < today;
        case 'current':
          return sem.startDate <= today && sem.endDate >= today;
        case 'upcoming':
          return sem.startDate > today;
        default:
          return true;
      }
    });
  }, [seminars, filter]);

  const getStatusChip = (status?: 'pending' | 'accepted' | 'refused') => {
    if (!status) return null;

    const config = {
      pending: { label: 'Invitation en attente', color: 'warning' as const, icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} /> },
      accepted: { label: 'Participation confirmée', color: 'success' as const, icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> },
      refused: { label: 'Participation refusée', color: 'error' as const, icon: <CancelIcon sx={{ fontSize: 16 }} /> },
    };

    const { label, color, icon } = (config as any)[status];
    return <Chip size="small" label={label} color={color} icon={icon} />;
  };

  async function ensureMyInviteIdForGroup(sem: SeminarGroup): Promise<string | null> {
    if (sem.myInviteId) return sem.myInviteId;
    try {
      const { data } = await (client.models.SeminarInvite.list as any)({
        filter: {
          startDate: { eq: sem.startDate },
          endDate: { eq: sem.endDate },
        },
      });
      const all = (data || []) as any[];
      const mine = all.find(i => i.owner === currentSub);
      return mine?.id || null;
    } catch {
      return null;
    }
  }

  const handleAccept = async (sem: SeminarGroup) => {
    if (!currentSub) return;
    const key = `${sem.startDate}_${sem.endDate}`;
    setActionBusy(key);
    try {
      const myInviteId = await ensureMyInviteIdForGroup(sem);
      if (!myInviteId) throw new Error('Invitation introuvable');
      await client.models.SeminarInvite.update({ id: myInviteId, status: 'accepted' as any });
      await applySeminarToCra(client as any, currentSub, sem.startDate, sem.endDate, sem.title);
      emitCraEntriesUpdated();
      setSnackbar({ open: true, message: 'Participation confirmée. CRA mis à jour.', severity: 'success' });
      await loadSeminars();
    } catch (e) {
      setSnackbar({ open: true, message: 'Échec de la confirmation', severity: 'error' });
    } finally {
      setActionBusy(null);
    }
  };

  const handleRefuse = async (sem: SeminarGroup) => {
    if (!currentSub) return;
    const key = `${sem.startDate}_${sem.endDate}`;
    setActionBusy(key);
    try {
      const myInviteId = await ensureMyInviteIdForGroup(sem);
      if (!myInviteId) throw new Error('Invitation introuvable');
      await client.models.SeminarInvite.update({ id: myInviteId, status: 'refused' as any });
      await removeSeminarFromCra(client as any, currentSub, sem.startDate, sem.endDate);
      emitCraEntriesUpdated();
      setSnackbar({ open: true, message: 'Participation refusée. CRA nettoyé.', severity: 'success' });
      await loadSeminars();
    } catch (e) {
      setSnackbar({ open: true, message: 'Échec de l’opération', severity: 'error' });
    } finally {
      setActionBusy(null);
    }
  };

  // Open create dialog: if a draft exists, load it; otherwise open empty form
  const openCreateDialog = async () => {
    const loaded = await loadDraftIfAny();
    if (!loaded) {
      setCreateDialog(prev => ({ ...prev, open: true }));
      setDraftLoaded(false);
    }
  };

  // Close dialog and persist current content as draft
  const closeCreateDialog = () => {
    // Force an autosave immediately with current state
    autosaveDraft({ ...createDialog, open: true });
    setCreateDialog(prev => ({ ...prev, open: false }));
  };

  // Autosave on changes while dialog is open
  useEffect(() => {
    if (!createDialog.open) return;
    if (skipNextAutosaveRef.current) { skipNextAutosaveRef.current = false; return; }
    const id = setTimeout(() => autosaveDraft(createDialog), 200);
    return () => clearTimeout(id);
  }, [createDialog, autosaveDraft]);

  // Derive a local draft group to display in the list for admins when a draft exists
  const draftGroup = useMemo<SeminarGroup | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
      if (!raw) return null;
      const d = JSON.parse(raw || '{}') as any;
      const hasContent = !!(d.startDate || d.endDate || d.location || d.activities || d.details || d.imageUrl || (d.scope === 'user' && d.userId));
      if (!hasContent) return null;
      const startDate = d.startDate || '';
      const endDate = d.endDate || d.startDate || '';
      return {
        startDate,
        endDate,
        title: 'Séminaire',
        location: d.location || '',
        activities: d.activities || '',
        details: d.details || '',
        imageUrl: d.imageUrl || '',
        totalInvites: 0,
        acceptedCount: 0,
        refusedCount: 0,
        pendingCount: 0,
        invites: [],
        isDraft: true,
      };
    } catch {
      return null;
    }
  }, [draftKey, draftRev]);

  // Global paste listener while the dialog is open so Ctrl+V works anywhere
  useEffect(() => {
    if (!createDialog.open) return;
    const onPaste = async (ev: ClipboardEvent) => {
      // Build a DataTransfer-like object from the clipboard event
      // Some browsers expose clipboardData directly compatible with DataTransfer
      const dt = (ev.clipboardData || (window as any).clipboardData) as DataTransfer | null;
      if (!dt) return;
      // Try to handle; if we set preview or uploaded, prevent default
      const hadFiles = (dt.files && dt.files.length) || (dt.items && Array.from(dt.items).some(it => it.type?.startsWith('image/')));
      const hadText = !!(dt.getData('text') || dt.getData('text/plain'));
      await handlePasteFromData(dt);
      if (hadFiles || hadText) {
        ev.preventDefault();
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [createDialog.open, handlePasteFromData]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a1a1a', mb: 1 }}>
              Séminaires
            </Typography>
            <Typography variant="body1" sx={{ color: '#666' }}>
              Découvrez tous les séminaires organisés par l'entreprise
            </Typography>
          </Box>
          {isAdmin && (
            <Button
              variant="contained"
              onClick={openCreateDialog}
              sx={{ backgroundColor: '#894991', '&:hover': { backgroundColor: '#6a3a7a' } }}
            >
              Créer un séminaire
            </Button>
          )}
        </Box>
      </Box>

      {/* Filter */}
      <Box sx={{ mb: 4 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filtrer par période</InputLabel>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            label="Filtrer par période"
          >
            <MenuItem value="all">Tous les séminaires</MenuItem>
            <MenuItem value="upcoming">À venir</MenuItem>
            <MenuItem value="current">En cours</MenuItem>
            <MenuItem value="past">Passés</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Seminars Grid */}
      <Grid container spacing={3}>
        {loading ? (
          // Loading skeletons
          [1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ height: '100%' }}>
                <Skeleton variant="rectangular" height={200} />
                <CardContent>
                  <Skeleton variant="text" sx={{ fontSize: '1.5rem' }} />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="80%" />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : filteredSeminars.length === 0 && !draftGroup ? (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ color: '#999', mb: 2 }}>
                Aucun séminaire à afficher
              </Typography>
            </Box>
          </Grid>
        ) : (
          <>
            {isAdmin && draftGroup && (
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ height: '100%', opacity: 0.6, filter: 'grayscale(100%)' }}>
                  <Box sx={{ position: 'relative' }}>
                    {draftGroup.imageUrl ? (
                      <CardMedia
                        component="img"
                        height="200"
                        image={isHttpUrl(draftGroup.imageUrl) ? draftGroup.imageUrl : imagePreview || '/logo/logo_sans_ecriture.png'}
                        alt="Brouillon"
                      />
                    ) : (
                      <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f3f3f3' }}>
                        <ImageIcon sx={{ fontSize: 48, color: '#bbb' }} />
                      </Box>
                    )}
                    <Chip size="small" label="Brouillon" color="default" sx={{ position: 'absolute', top: 8, left: 8, bgcolor: '#e0e0e0' }} />
                  </Box>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#666', mb: 1 }}>
                      Séminaire (Brouillon)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#777', mb: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 18 }} />
                      <Typography variant="body2">
                        {draftGroup.startDate && draftGroup.endDate ? formatDateRange(draftGroup.startDate, draftGroup.endDate) : 'Dates à définir'}
                      </Typography>
                    </Box>
                    {draftGroup.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#777', mb: 1 }}>
                        <LocationOnIcon sx={{ fontSize: 18 }} />
                        <Typography variant="body2">{draftGroup.location}</Typography>
                      </Box>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={openCreateDialog}>Continuer</Button>
                      <Button size="small" color="warning" onClick={clearDraft}>Supprimer</Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {filteredSeminars.map((sem, idx) => {
            const groupKey = `${sem.startDate}_${sem.endDate}`;
            const isBusy = actionBusy === groupKey;
            return (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                    }
                  }}
                >
                  {/* Image */}
                  {(() => {
                    const src = isHttpUrl(sem.imageUrl) ? sem.imageUrl : imageUrls[groupKey];
                    return src ? (
                      <CardMedia
                        component="img"
                        height="200"
                        image={src}
                        alt="Séminaire"
                        sx={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: 200,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 64, opacity: 0.5 }} />
                      </Box>
                    );
                  })()}

                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Date */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CalendarTodayIcon sx={{ fontSize: 18, color: '#894991' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#894991' }}>
                        {formatDateRange(sem.startDate, sem.endDate)}
                      </Typography>
                    </Box>

                    {/* Title */}
                    {sem.title && (
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#222' }}>
                        {sem.title}
                      </Typography>
                    )}

                    {/* Location */}
                    {sem.location && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                        <LocationOnIcon sx={{ fontSize: 18, color: '#666', mt: 0.25 }} />
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          {sem.location}
                        </Typography>
                      </Box>
                    )}

                    {/* Activities */}
                    {sem.activities && (
                      <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
                        <strong>Activités:</strong> {sem.activities}
                      </Typography>
                    )}

                    {/* Short details preview (keep compact) */}
                    {sem.details && (
                      <Typography variant="body2" sx={{ mb: 2, color: '#666', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sem.details}
                      </Typography>
                    )}

                    {/* Status */}
                    {sem.myStatus && (
                      <Box sx={{ mt: 'auto', mb: 1 }}>
                        {getStatusChip(sem.myStatus)}
                      </Box>
                    )}

                    {/* Actions / Message aligned to the right */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 1 }}>
                      {sem.myStatus === 'accepted' || sem.myStatus === 'refused' ? (
                        <Typography variant="body2" sx={{ color: '#555' }}>
                          {sem.myStatus === 'accepted' ? 'Vous avez déjà accepté' : 'Vous avez déjà refusé'}
                        </Typography>
                      ) : (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            disabled={isBusy}
                            onClick={() => handleAccept(sem)}
                            sx={{ textTransform: 'none' }}
                          >
                            Confirmer
                          </Button>
                          <Button
                            variant="outlined"
                            color="inherit"
                            size="small"
                            disabled={isBusy}
                            onClick={() => handleRefuse(sem)}
                            sx={{ textTransform: 'none' }}
                          >
                            Refuser
                          </Button>
                        </Stack>
                      )}
                    </Box>

                    {/* Participation Stats */}
                    <Box sx={{
                      pt: 2,
                      mt: 'auto',
                      borderTop: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                                Participants confirmés ({sem.acceptedCount})
                              </Typography>
                              {sem.invites
                                .filter(inv => inv.status === 'accepted')
                                .map((inv, i) => (
                                  <Typography key={i} variant="body2">
                                    • {getUserDisplayName(inv.owner)}
                                  </Typography>
                                ))}
                              {sem.acceptedCount === 0 && (
                                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                  Aucune confirmation pour le moment
                                </Typography>
                              )}
                            </Box>
                          }
                          arrow
                          placement="top"
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#666',
                              cursor: 'help',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dotted'
                            }}
                          >
                            <strong>{sem.acceptedCount}</strong> confirmés
                          </Typography>
                        </Tooltip>

                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                                Tous les invités ({sem.totalInvites})
                              </Typography>
                              {sem.invites.map((inv, i) => (
                                <Typography key={i} variant="body2">
                                  • {getUserDisplayName(inv.owner)}
                                  {inv.status === 'accepted' && ' ✓'}
                                  {inv.status === 'refused' && ' ✗'}
                                  {inv.status === 'pending' && ' ⏳'}
                                </Typography>
                              ))}
                            </Box>
                          }
                          arrow
                          placement="top"
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#666',
                              cursor: 'help',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dotted'
                            }}
                          >
                            <strong>{sem.totalInvites}</strong> invités
                          </Typography>
                        </Tooltip>
                      </Box>
                      {/* Always show navigation to details page */}
                      <Button
                        size="small"
                        variant="text"
                        component={Link}
                        href={`/seminaires/${encodeURIComponent(groupKey)}`}
                        sx={{ textTransform: 'none', color: '#555' }}
                      >
                        Voir plus
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
            })}
          </>
        )}
      </Grid>

      {/* Admin: Create seminar dialog */}
      {isAdmin && (
        <Dialog
          open={createDialog.open}
          onClose={() => { if (!createDialog.loading) closeCreateDialog(); }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Créer un séminaire
            {draftLoaded && (
              <Chip size="small" label="Brouillon chargé" color="warning" sx={{ ml: 1 }} />
            )}
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  InputLabelProps={{ shrink: true }}
                  value={createDialog.startDate}
                  inputRef={(el) => { startDateRef.current = el; }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCreateDialog(prev => ({
                      ...prev,
                      startDate: v,
                      endDate: (!prev.endDate || prev.endDate < v) ? v : prev.endDate,
                    }));
                    setTimeout(() => openEndPicker(), 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      openEndPicker();
                    }
                  }}
                />
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin"
                  InputLabelProps={{ shrink: true }}
                  value={createDialog.endDate}
                  inputRef={(el) => { endDateRef.current = el; }}
                  onChange={(e) => setCreateDialog(prev => ({ ...prev, endDate: e.target.value }))}
                  inputProps={{ min: createDialog.startDate || undefined }}
                  disabled={!createDialog.startDate}
                />
                {draftLoaded && (
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#8b5a94' }}>
                    Brouillon auto-enregistré. Vous pouvez continuer plus tard ou le supprimer.
                  </Typography>
                )}
              </Box>

              <TextField
                fullWidth
                label="Lieu"
                value={createDialog.location}
                onChange={(e) => setCreateDialog(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Ex: Paris, Salle de conférence"
              />

              <TextField
                fullWidth
                label="Activités"
                value={createDialog.activities}
                onChange={(e) => setCreateDialog(prev => ({ ...prev, activities: e.target.value }))}
                multiline
                rows={2}
                placeholder="Ex: Présentation, ateliers..."
              />

              <TextField
                fullWidth
                label="Détails"
                value={createDialog.details}
                onChange={(e) => setCreateDialog(prev => ({ ...prev, details: e.target.value }))}
                multiline
                rows={3}
                placeholder="Informations supplémentaires..."
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Image de couverture</Typography>
                {imagePreview ? (
                  <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', border: '1px solid #eee' }}>
                    <Box component="img" src={imagePreview} alt="Aperçu" sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                    <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}>
                      {uploading && (
                        <Chip size="small" label={`${uploadProgress}%`} />
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIconOutline />}
                        onClick={() => { setImagePreview(null); setCreateDialog(p => ({ ...p, imageUrl: '' })); setUploadProgress(0); }}
                      >
                        Retirer
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleImageFiles(e.dataTransfer.files); }}
                    onPaste={handlePasteImage}
                    sx={{
                      border: '2px dashed #c7b4d2',
                      borderRadius: 1.5,
                      p: 3,
                      textAlign: 'center',
                      background: '#fbf7fc',
                      cursor: 'pointer',
                      '&:hover': { background: '#f7effa' }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (ev: any) => handleImageFiles(ev.target.files);
                      input.click();
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 42, color: '#894991', mb: 1 }} />
                    <Typography variant="body2" sx={{ color: '#555' }}>
                      Glissez-déposez une image, cliquez pour sélectionner un fichier
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#777' }}>
                      ou pressez Ctrl+V pour coller depuis le presse-papiers — JPG, PNG, GIF — max 10 Mo
                    </Typography>
                  </Box>
                )}
                {createDialog.imageUrl && !imagePreview && (
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#555' }}>
                    Image sélectionnée: {createDialog.imageUrl}
                  </Typography>
                )}
              </Box>

              <FormControl fullWidth>
                <InputLabel>Portée</InputLabel>
                <Select
                  value={createDialog.scope}
                  onChange={(e) => setCreateDialog(prev => ({ ...prev, scope: e.target.value as 'global' | 'user', userId: e.target.value === 'global' ? null : prev.userId }))}
                  label="Portée"
                >
                  <MenuItem value="global">Global (tous les utilisateurs)</MenuItem>
                  <MenuItem value="user">Utilisateur spécifique</MenuItem>
                </Select>
              </FormControl>

              {createDialog.scope === 'user' && (
                <FormControl fullWidth>
                  <InputLabel>Utilisateur</InputLabel>
                  <Select
                    value={createDialog.userId || ''}
                    onChange={(e) => setCreateDialog(prev => ({ ...prev, userId: e.target.value }))}
                    label="Utilisateur"
                  >
                    <MenuItem value="" disabled>Choisir un utilisateur</MenuItem>
                    {usersList.map(u => {
                      const name = [u.given_name, u.family_name].filter(Boolean).join(' ') || u.username;
                      return <MenuItem key={u.username} value={u.username}>{name}</MenuItem>;
                    })}
                  </Select>
                </FormControl>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCreateDialog} disabled={createDialog.loading}>
              Annuler
            </Button>
            {draftLoaded && (
              <Button
                onClick={() => {
                  clearDraft();
                  // Reset form to empty but keep dialog open
                  setCreateDialog(prev => ({ ...prev, startDate: '', endDate: '', location: '', activities: '', details: '', imageUrl: '' }));
                  setImagePreview(null);
                }}
                color="warning"
                disabled={createDialog.loading}
              >
                Supprimer le brouillon
              </Button>
            )}
            <Button
              onClick={createSeminar}
              variant="contained"
              disabled={createDialog.loading || !createDialog.startDate || !createDialog.endDate}
              sx={{ backgroundColor: '#894991', '&:hover': { backgroundColor: '#6a3a7a' } }}
            >
              {createDialog.loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Créer le séminaire
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

  if (start === end) {
    return startDate.toLocaleDateString('fr-FR', options);
  }

  return `${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('fr-FR', options)}`;
}