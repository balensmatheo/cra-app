"use client";

import { useState, useEffect } from 'react';
import { TextField, Button, Typography } from '@mui/material';
import { confirmSignUp } from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '@/components/auth/AuthLayout';

export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      router.push('/signin?confirmed=true');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Confirmer l'inscription">
      <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', mb: 1 }}>
        Un code de confirmation a été envoyé à votre adresse email
      </Typography>
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
        label="Code de confirmation"
        value={code}
        onChange={e => setCode(e.target.value)}
        fullWidth
        disabled={loading}
        required
      />
      {error && <Typography color="error" sx={{ fontSize: 14 }}>{error}</Typography>}
      <Button
        variant="contained"
        onClick={handleConfirm}
        sx={{
          background: '#894991',
          '&:hover': { background: '#6a3a7a' },
          fontWeight: 600,
          textTransform: 'none',
          width: '100%'
        }}
        disabled={loading || !email.trim() || !code.trim()}
      >
        {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "Confirmer"}
      </Button>
      <Button
        variant="text"
        onClick={() => router.push('/signin')}
        sx={{ color: '#894991', textTransform: 'none', width: '100%' }}
        disabled={loading}
      >
        Retour à la connexion
      </Button>
    </AuthLayout>
  );
}