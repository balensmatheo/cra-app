"use client";

import { useEffect, useState } from 'react';
import { TextField, Button, Typography, Alert, Box } from '@mui/material';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '@/components/auth/AuthLayout';

export default function SigninPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmedMessage, setShowConfirmedMessage] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setCheckingUser(false));
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (searchParams.get('confirmed') === 'true') {
      setShowConfirmedMessage(true);
      setTimeout(() => setShowConfirmedMessage(false), 5000);
    }
  }, [searchParams]);

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

  if (user) {
    return null;
  }

  return (
    <AuthLayout title="Se connecter">
      {showConfirmedMessage && (
        <Alert severity="success" sx={{ width: '100%', mb: 1 }}>
          Compte confirmé avec succès ! Vous pouvez maintenant vous connecter.
        </Alert>
      )}
      
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        fullWidth
        disabled={loading}
        required
      />
      <TextField
        label="Mot de passe"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        fullWidth
        disabled={loading}
        required
      />
      {error && <Typography color="error" sx={{ fontSize: 14 }}>{error}</Typography>}
      <Button
        variant="contained"
        onClick={handleSignIn}
        sx={{
          background: '#894991',
          '&:hover': { background: '#6a3a7a' },
          fontWeight: 600,
          textTransform: 'none',
          width: '100%'
        }}
        disabled={loading || !email.trim() || !password.trim()}
      >
        {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "Se connecter"}
      </Button>
      <Button
        variant="text"
        onClick={() => router.push('/signup')}
        sx={{ color: '#894991', textTransform: 'none', width: '100%' }}
        disabled={loading}
      >
        Créer un compte
      </Button>
    </AuthLayout>
  );
}