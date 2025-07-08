"use client";

import { ReactNode, useEffect, useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import {
  signIn,
  signUp,
  confirmSignUp,
  getCurrentUser,
} from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import CircularProgress from '@mui/material/CircularProgress';

export default function SignIn({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [form, setForm] = useState<'signIn' | 'signUp' | 'confirm'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setCheckingUser(false));
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  if (checkingUser) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <CircularProgress size={48} sx={{ color: '#894991' }} />
      </Box>
    );
  }

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn({ username: email, password });
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setForm('confirm');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      setForm('signIn');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <>{children}</>;
  }

  // Facteur commun de style pour le conteneur du formulaire
  const formBoxSx = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    p: 4,
    maxWidth: 350,
    margin: '100px auto',
    background: 'var(--background, #fff)',
    borderRadius: 4,
    boxShadow: '0 4px 24px rgba(137,73,145,0.08)',
    alignItems: 'center',
  };

  const logoBlock = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, width: '100%' }}>
      <Image src="/logo/logo_sans_ecriture.png" alt="Logo" width={56} height={56} style={{ marginBottom: 8 }} />
      <Typography
        variant="h5"
        sx={{
          color: '#894991',
          fontWeight: 700,
          letterSpacing: 1,
          fontFamily: 'var(--font-geist-sans, Arial, Helvetica, sans-serif)',
          textAlign: 'center',
          width: '100%',
          wordBreak: 'break-word',
          lineHeight: 1.2,
          fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
          maxWidth: 260,
          mx: 'auto',
        }}
      >
        Compte rendu d'activité
      </Typography>
    </Box>
  );

  if (form === 'signUp') {
    return (
      <Box sx={formBoxSx}>
        {logoBlock}
        <Typography variant="h6" sx={{ color: '#894991', fontWeight: 600 }}>Créer un compte</Typography>
        <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} fullWidth disabled={loading} />
        <TextField label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth disabled={loading} />
        {error && <Typography color="error" sx={{ fontSize: 14 }}>{error}</Typography>}
        <Button variant="contained" onClick={handleSignUp} sx={{ background: '#894991', '&:hover': { background: '#6a3a7a' }, fontWeight: 600, textTransform: 'none', width: '100%' }} disabled={loading}>
          {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "S'inscrire"}
        </Button>
        <Button variant="text" onClick={() => { setForm('signIn'); setError(''); }} sx={{ color: '#894991', textTransform: 'none', width: '100%' }} disabled={loading}>
          Se connecter
        </Button>
      </Box>
    );
  }

  if (form === 'confirm') {
    return (
      <Box sx={formBoxSx}>
        {logoBlock}
        <Typography variant="h6" sx={{ color: '#894991', fontWeight: 600 }}>Confirmer l'inscription</Typography>
        <TextField label="Code" value={code} onChange={e => setCode(e.target.value)} fullWidth disabled={loading} />
        {error && <Typography color="error" sx={{ fontSize: 14 }}>{error}</Typography>}
        <Button variant="contained" onClick={handleConfirm} sx={{ background: '#894991', '&:hover': { background: '#6a3a7a' }, fontWeight: 600, textTransform: 'none', width: '100%' }} disabled={loading}>
          {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "Confirmer"}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={formBoxSx}>
        {logoBlock}
        <Typography variant="h6" sx={{ color: '#894991', fontWeight: 600 }}>Se connecter</Typography>
        <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} fullWidth disabled={loading} />
        <TextField label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth disabled={loading} />
        {error && <Typography color="error" sx={{ fontSize: 14 }}>{error}</Typography>}
        <Button variant="contained" onClick={handleSignIn} sx={{ background: '#894991', '&:hover': { background: '#6a3a7a' }, fontWeight: 600, textTransform: 'none', width: '100%' }} disabled={loading}>
          {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "Se connecter"}
        </Button>
        <Button variant="text" onClick={() => { setForm('signUp'); setError(''); }} sx={{ color: '#894991', textTransform: 'none', width: '100%' }} disabled={loading}>
          Créer un compte
        </Button>
      </Box>
    </Box>
  );
}
