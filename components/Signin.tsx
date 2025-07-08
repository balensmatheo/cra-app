"use client";

import { ReactNode, useEffect, useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import {
  signIn,
  signUp,
  confirmSignUp,
  getCurrentUser,
} from 'aws-amplify/auth';

export default function Signin({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState<'signIn' | 'signUp' | 'confirm'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  const handleSignIn = async () => {
    try {
      await signIn({ username: email, password });
      const current = await getCurrentUser();
      setUser(current);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignUp = async () => {
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
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      setForm('signIn');
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (user) {
    return <>{children}</>;
  }

  if (form === 'signUp') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 4, maxWidth: 300, margin: '100px auto' }}>
        <Typography variant="h6">Créer un compte</Typography>
        <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <TextField label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <Typography color="error">{error}</Typography>}
        <Button variant="contained" onClick={handleSignUp}>S'inscrire</Button>
        <Button variant="text" onClick={() => { setForm('signIn'); setError(''); }}>Se connecter</Button>
      </Box>
    );
  }

  if (form === 'confirm') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 4, maxWidth: 300, margin: '100px auto' }}>
        <Typography variant="h6">Confirmer l'inscription</Typography>
        <TextField label="Code" value={code} onChange={e => setCode(e.target.value)} />
        {error && <Typography color="error">{error}</Typography>}
        <Button variant="contained" onClick={handleConfirm}>Confirmer</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 4, maxWidth: 300, margin: '100px auto' }}>
      <Typography variant="h6">Se connecter</Typography>
      <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <TextField label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <Typography color="error">{error}</Typography>}
      <Button variant="contained" onClick={handleSignIn}>Se connecter</Button>
      <Button variant="text" onClick={() => { setForm('signUp'); setError(''); }}>Créer un compte</Button>
    </Box>
  );
}
