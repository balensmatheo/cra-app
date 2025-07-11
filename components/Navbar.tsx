"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Image from "next/image";
import { signOut } from 'aws-amplify/auth';
import { IconButton, Avatar, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CRADrawer from './CRADrawer';
import { useCRA } from '@/context/CRAContext';

export default function Navbar() {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { submittedMonths, selectMonth } = useCRA();
  const open = Boolean(anchorEl);

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
      padding: { xs: "0 16px", md: "0 32px" },
      height: 72,
      boxShadow: "0 2px 8px #f0f1f2"
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
        onMonthSelect={selectMonth}
      />
      <Image
        src="/logo/logo_sans_ecriture.png"
        alt="Logo Decision Network"
        width={48}
        height={48}
        style={{ objectFit: "contain", cursor: "pointer" }}
        onClick={() => router.push('/')} // Ajout de la redirection sur clic
      />
      <Box component="span" sx={{
        color: "#894991",
        fontWeight: 700,
        fontSize: 24,
        marginLeft: 5,
        letterSpacing: 1,
        display: { xs: 'none', md: 'block' }
      }}>
        Compte rendu d'activité
      </Box>
      <Box sx={{ flex: 1 }} />
      <div>
        <IconButton
          size="large"
          aria-label="account of current user"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          onClick={handleMenu}
          color="inherit"
        >
          <Avatar sx={{ bgcolor: '#894991' }} />
        </IconButton>
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={open}
          onClose={handleClose}
        >
          <MenuItem onClick={handleProfile}>Profil</MenuItem>
          <MenuItem onClick={handleLogout}>Déconnexion</MenuItem>
        </Menu>
      </div>
    </Box>
  );
}