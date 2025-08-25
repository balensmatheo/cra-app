"use client";
import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Box, Typography, Chip, Avatar, Grid, Card, CardContent, CardMedia, Divider, Skeleton } from '@mui/material';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { getUrl } from 'aws-amplify/storage';

const client = generateClient<Schema>();

function parseKey(key: string) {
  const [startDate, endDate] = key.split('_');
  if (!startDate || !endDate) return null;
  return { startDate, endDate };
}

function formatDateRange(s: string, e: string) {
  const fmt = (d: string) => {
    try {
      const [y, m, dd] = d.split('-').map(Number);
      return new Date(y, (m || 1) - 1, dd || 1).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
  };
  return `${fmt(s)} — ${fmt(e)}`;
}

export default function SeminarDetailPage() {
  const params = useParams();
  const seminarKey = String(params?.seminarKey || '');
  const range = parseKey(seminarKey);
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<{ title?: string; location?: string; activities?: string; details?: string; imageUrl?: string }|null>(null);
  const [invites, setInvites] = useState<Array<{ id: string; owner: string; status: 'pending'|'accepted'|'refused' }>>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, { given?: string; family?: string }>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!range) return;
    (async () => {
      try {
        setLoading(true);
        const { data } = await (client.models.SeminarInvite.list as any)({
          filter: { startDate: { eq: range.startDate }, endDate: { eq: range.endDate } }
        });
        const list = (data || []) as any[];
        if (!list.length) {
          setLoading(false);
          return;
        }
        const first = list[0];
        setHeader({ title: first.title, location: first.location, activities: first.activities, details: first.details, imageUrl: first.imageUrl });
        setInvites(list.map(inv => ({ id: inv.id, owner: inv.owner, status: inv.status || 'pending' })));
        // Try resolve S3 image
        const img = String(first.imageUrl || '').trim();
        if (img && !/^https?:\/\//i.test(img)) {
          try {
            const { url } = await getUrl({ path: img, options: { validateObjectExistence: true } });
            setImageUrl(url.toString());
          } catch { setImageUrl(null); }
        } else {
          setImageUrl(img || null);
        }
        // Load user names via admin query
        try {
          const { data: q, errors } = await client.queries.listUsers({});
          if (!errors && q) {
            const payload = typeof q === 'string' ? JSON.parse(q as any) : (q as any);
            const users = (payload?.users || []) as any[];
            const map: Record<string, { given?: string; family?: string }> = {};
            users.forEach(u => { map[u.username] = { given: u.given_name, family: u.family_name }; });
            setNameMap(map);
            // Resolve public avatars in parallel (best-effort)
            const pairs = await Promise.all(users.map(async u => {
              const sub = u.username as string;
              try {
                const { url } = await getUrl({ key: `avatars/${sub}.jpg`, options: { accessLevel: 'guest', expiresIn: 300 } });
                return [sub, url.toString()] as const;
              } catch { return null; }
            }));
            const amap: Record<string, string> = {};
            for (const p of pairs) if (p) amap[p[0]] = p[1];
            setAvatarMap(amap);
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [seminarKey]);

  if (!range) return notFound();

  const getUserLabel = (sub: string) => {
    const u = nameMap[sub];
    if (!u) return sub;
    const parts = [u.given, u.family].filter(Boolean);
    return parts.length ? parts.join(' ') : sub;
  };

  const accepted = invites.filter(i => i.status === 'accepted');
  const refused = invites.filter(i => i.status === 'refused');
  const pending = invites.filter(i => i.status === 'pending');

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ flex: '0 0 240px' }}>
          {loading ? (
            <Skeleton variant="rectangular" width={240} height={160} />
          ) : imageUrl ? (
            <CardMedia component="img" image={imageUrl} sx={{ width: 240, height: 160, objectFit: 'cover', borderRadius: 1 }} />
          ) : (
            <Box sx={{ width: 240, height: 160, bgcolor: '#eee', borderRadius: 1 }} />
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          {loading ? (
            <>
              <Skeleton variant="text" width={280} height={34} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width={200} height={22} />
              <Skeleton variant="text" width={260} height={20} sx={{ mt: 1.5 }} />
              <Skeleton variant="text" width={320} height={20} sx={{ mt: 0.5 }} />
            </>
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{header?.title || 'Séminaire'}</Typography>
              <Typography variant="subtitle2" sx={{ color: '#666', mt: 0.5 }}>{formatDateRange(range.startDate, range.endDate)}</Typography>
              {header?.location && (
                <Typography variant="body2" sx={{ color: '#444', mt: 1 }}>
                  Lieu: {header.location}
                </Typography>
              )}
              {header?.activities && (
                <Typography variant="body2" sx={{ color: '#444', mt: 1 }}>
                  Activités: {header.activities}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Details */}
      {loading ? (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Skeleton variant="text" width={120} height={28} sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
          </CardContent>
        </Card>
      ) : header?.details ? (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Détails</Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{header.details}</Typography>
          </CardContent>
        </Card>
      ) : null}

      {/* Participation */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Participants</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Accepté ({accepted.length})</Typography>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Box key={`acc-sk-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Skeleton variant="circular" width={28} height={28} />
                    <Skeleton variant="text" width={140} height={18} />
                  </Box>
                ))
              ) : (
                <>
                  {accepted.map((inv) => (
                    <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar src={avatarMap[inv.owner]} sx={{ width: 28, height: 28 }} />
                      <Typography variant="body2">{getUserLabel(inv.owner)}</Typography>
                    </Box>
                  ))}
                  {accepted.length === 0 && <Typography variant="body2" sx={{ color: '#777' }}>Aucun</Typography>}
                </>
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Refusé ({refused.length})</Typography>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Box key={`ref-sk-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Skeleton variant="circular" width={28} height={28} />
                    <Skeleton variant="text" width={140} height={18} />
                  </Box>
                ))
              ) : (
                <>
                  {refused.map((inv) => (
                    <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar src={avatarMap[inv.owner]} sx={{ width: 28, height: 28 }} />
                      <Typography variant="body2">{getUserLabel(inv.owner)}</Typography>
                    </Box>
                  ))}
                  {refused.length === 0 && <Typography variant="body2" sx={{ color: '#777' }}>Aucun</Typography>}
                </>
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>En attente ({pending.length})</Typography>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Box key={`pen-sk-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Skeleton variant="circular" width={28} height={28} />
                    <Skeleton variant="text" width={140} height={18} />
                  </Box>
                ))
              ) : (
                <>
                  {pending.map((inv) => (
                    <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar src={avatarMap[inv.owner]} sx={{ width: 28, height: 28 }} />
                      <Typography variant="body2">{getUserLabel(inv.owner)}</Typography>
                    </Box>
                  ))}
                  {pending.length === 0 && <Typography variant="body2" sx={{ color: '#777' }}>Aucun</Typography>}
                </>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
