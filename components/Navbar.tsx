"use client";
import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Image from "next/image";
import { signOut, fetchAuthSession } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { IconButton, Avatar, Menu, MenuItem, Tooltip } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Grow from '@mui/material/Grow';
import MenuIcon from '@mui/icons-material/Menu';
import CRADrawer from './CRADrawer';
import { useCRA } from '@/context/CRAContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { submittedMonths, monthStatusMap, currentYear, setMonthString } = useCRA() as any;
  const open = Boolean(anchorEl);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  React.useEffect(() => {
  (async () => {
      try {
        // If authenticated, try to get a signed URL for the avatar
        const session = await fetchAuthSession();
    if (!session?.tokens) return;
    const groups = (session.tokens.idToken?.payload as any)?.['cognito:groups'] as string[] | undefined;
    setIsAdmin(!!groups?.includes('ADMINS'));
        const key = 'profile/avatar';
        const { url } = await getUrl({ key, options: { accessLevel: 'protected', expiresIn: 300 } });
        setAvatarUrl(url.toString());
      } catch {
        // no avatar or not authenticated
      }
    })();
  }, []);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    router.push('/profile');
    handleClose();
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/signin');
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
    } finally {
      handleClose();
    }
  };

  return (
    <Box sx={{
      background: "#fff",
      display: "flex",
      alignItems: "center",
  // Move content slightly away from the right edge so the profile menu can center below the avatar
  padding: { xs: "0 24px", md: "0 48px" },
      height: 72,
  boxShadow: "0 2px 8px #f0f1f2",
  position: 'sticky',
  top: 0,
  zIndex: 1100
    }}>
      <IconButton
        size="large"
        edge="start"
        color="inherit"
        aria-label="menu"
        sx={{ mr: 2 }}
        onClick={() => setDrawerOpen(true)}
      >
        <MenuIcon />
      </IconButton>
      <CRADrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        submittedMonths={submittedMonths}
        onMonthSelect={(index:number) => {
          const ym = `${currentYear}-${String(index + 1).padStart(2,'0')}`;
          setMonthString(ym);
          router.push(`/cra/${ym}?user=me`);
        }}
        monthStatusMap={monthStatusMap}
      />
      <Image
        src="/logo/logo_sans_ecriture.png"
        alt="Logo Decision Network"
        width={48}
        height={48}
        style={{ objectFit: "contain", cursor: "pointer" }}
        onClick={() => router.push('/')}
      />
      {/* Horizontal links */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        gap: 3,
        ml: 5
      }}>
        {[
          { label: 'Calendrier', href: '/calendrier' },
          { label: 'Salariés', href: '/salaries' },
          { label: 'Congés', href: '/conges' },
        ].map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Box
              key={item.href}
              role="link"
              tabIndex={0}
              onClick={() => router.push(item.href)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(item.href); }}
              sx={{
                cursor: 'pointer',
                color: active ? '#111' : '#6b7280',
                fontWeight: 600,
                fontSize: 14,
                px: 0.5,
                pb: 1,
                borderBottom: active ? '2px solid #894991' : '2px solid transparent',
                transition: 'color .2s ease, border-color .2s ease',
                '&:hover': { color: '#111', borderBottomColor: '#e5e7eb' }
              }}
            >
              {item.label}
            </Box>
          );
        })}
      </Box>
  <Box sx={{ flex: 1 }} />
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: { xs: 2, md: 3 } }}>
        {isAdmin && (
          <Tooltip title="Vous êtes administrateur" arrow>
            <Box
              aria-hidden
              sx={{
                width: 30,
                height: 30,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                background: 'linear-gradient(180deg, #faf5fc 0%, #f3e8f6 100%)',
                border: '1px solid #e7cdef',
                boxShadow: '0 3px 10px rgba(137,73,145,0.18)',
                color: '#894991',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 18px rgba(137,73,145,0.25)'
                }
              }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
        )}
        <IconButton
          size="large"
          aria-label="account of current user"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          onClick={handleMenu}
          color="inherit"
          sx={{ p: 0.5, borderRadius: '999px' }}
        >
          <Box
            sx={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              transition: 'transform .2s ease',
              '&:hover .avatar-img': {
                transform: 'scale(1.06)',
                boxShadow: '0 8px 24px rgba(137,73,145,.35)'
              },
              '&:hover .avatar-ring': {
                opacity: 1,
                transform: 'scale(1)'
              },
              '&:focus-within .avatar-ring': {
                opacity: 1,
                transform: 'scale(1)'
              }
            }}
          >
            <Avatar
              src={avatarUrl}
              className="avatar-img"
              sx={{
                bgcolor: '#894991',
                width: 40,
                height: 40,
                transition: 'transform .2s ease, box-shadow .25s ease'
              }}
            />
            <Box
              className="avatar-ring"
              sx={{
                position: 'absolute',
                inset: -3,
                borderRadius: '50%',
                border: '2px solid #894991',
                opacity: 0,
                transform: 'scale(.9)',
                transition: 'opacity .25s ease, transform .25s ease',
                pointerEvents: 'none'
              }}
            />
          </Box>
        </IconButton>
  <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          keepMounted
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          disableScrollLock
          TransitionComponent={Grow}
          TransitionProps={{ style: { transformOrigin: 'top center' } }}
          PaperProps={{
            sx: {
              mt: 1.25,
              overflow: 'visible',
              borderRadius: 1.5,
              boxShadow: '0px 10px 25px rgba(0,0,0,0.12)',
              border: '1px solid #eee',
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                borderLeft: '1px solid #eee',
                borderTop: '1px solid #eee',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)'
              }
            }
          }}
          open={open}
          onClose={handleClose}
        >
          {isAdmin && (
            <MenuItem onClick={() => { router.push('/admin'); handleClose(); }}>Administration</MenuItem>
          )}
          <MenuItem onClick={handleProfile}>Profil</MenuItem>
          <MenuItem onClick={handleLogout}>Déconnexion</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}