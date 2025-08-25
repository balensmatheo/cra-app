"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Box, Typography, Grid, Card, CardActionArea, Skeleton } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import WorkOffOutlinedIcon from '@mui/icons-material/WorkOffOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
// Removed Users option; icon import no longer needed

export default function AdminHomePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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

  if (isAdmin === null) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={260} height={36} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
              <Card elevation={0} sx={{ border: '1px solid #eee', borderRadius: 2, p: 2.25 }}>
                <Skeleton variant="rounded" width={44} height={44} sx={{ mb: 1.25, borderRadius: 2 }} />
                <Skeleton variant="text" width={160} height={24} />
                <Skeleton variant="text" width={220} height={18} />
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }
  if (!isAdmin) {
    return <Box sx={{ p: 4 }}><Typography color="error">Accès refusé</Typography></Box>;
  }

  const items = [
    {
      title: 'Dashboard',
      description: "Vue globale et analytique",
      icon: <QueryStatsOutlinedIcon />,
      href: '/admin/dashboard',
      color: '#6b21a8',
    },
    {
      title: 'Gestion des absences',
      description: 'Valider / refuser les demandes et voir les pièces jointes',
      icon: <WorkOffOutlinedIcon />,
      href: '/admin/absences',
      color: '#9c27b0',
    },
    {
      title: 'Liste des CRA',
      description: 'Voir les CRA validés par mois au format liste',
      icon: <ListAltOutlinedIcon />,
      href: '/admin/cra-list',
      color: '#894991',
    },
    {
      title: 'Clôture des CRA',
      description: 'Clôturer les mois',
      icon: <TaskAltOutlinedIcon />,
      href: '/admin/cra',
      color: '#2e7d32',
    },
    {
      title: 'Catégories',
      description: 'Gérer les catégories',
      icon: <CategoryOutlinedIcon />,
      href: '/admin/categories',
      color: '#0b79d0',
    },
    {
      title: 'Jours spéciaux',
      description: 'Gérer fériés, séminaires, etc.',
      icon: <EventAvailableOutlinedIcon />,
      href: '/admin/special-days',
      color: '#d97706',
  },
  ];

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#894991', mb: 3 }}>Administration</Typography>
      <Grid container spacing={2}>
        {items.map((it) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={it.href}>
            <Card elevation={0} sx={{
              border: '1px solid #eee',
              borderRadius: 2,
              background: '#fff',
              '&:hover': { boxShadow: '0 6px 22px rgba(0,0,0,0.08)', borderColor: '#e6d7ea' },
            }}>
              <CardActionArea onClick={() => router.push(it.href)} sx={{ p: 2.25 }}>
                <Box sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  background: `${it.color}14`,
                  color: it.color,
                  border: `1px solid ${it.color}55`,
                  mb: 1.25,
                }}>
                  {it.icon}
                </Box>
                <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{it.title}</Typography>
                <Typography sx={{ fontSize: 13, color: '#6b7280' }}>{it.description}</Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
