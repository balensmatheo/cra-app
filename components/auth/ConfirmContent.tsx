"use client";

import { useState, useEffect } from 'react';
import { TextField, Button, Typography, Alert } from '@mui/material';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '@/components/auth/AuthLayout';

interface ConfirmContentProps {
  searchParams: URLSearchParams;
}

export default function ConfirmContent({ searchParams }: ConfirmContentProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [fromSignin, setFromSignin] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const fromParam = searchParams.get('from');
    if (emailParam) {
      setEmail(emailParam);
    }
    if (fromParam === 'signin') {
      setFromSignin(true);
    }
  }, [searchParams]);

  // Gestion du compte à rebours pour le renvoi de code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      router.push('/signin?confirmed=true');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setResendLoading(true);
    setError('');
    setResendSuccess(false);
    
    try {
      await resendSignUpCode({ username: email });
      setResendSuccess(true);
      setResendCooldown(60); // 60 secondes de cooldown
      setTimeout(() => setResendSuccess(false), 5000); // Masquer le message après 5 secondes
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout title="Confirmer l'inscription">
      {fromSignin && (
        <Alert severity="info" sx={{ width: '100%', mb: 1 }}>
          Votre compte n'est pas encore confirmé. Veuillez saisir le code de confirmation reçu par email.
        </Alert>
      )}
      
      {resendSuccess && (
        <Alert severity="success" sx={{ width: '100%', mb: 1 }}>
          Un nouveau code de confirmation a été envoyé à votre adresse email.
        </Alert>
      )}
      
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
        variant="outlined"
        onClick={handleResendCode}
        sx={{
          color: '#894991',
          borderColor: '#894991',
          '&:hover': {
            borderColor: '#6a3a7a',
            backgroundColor: 'rgba(137, 73, 145, 0.04)'
          },
          fontWeight: 600,
          textTransform: 'none',
          width: '100%'
        }}
        disabled={resendLoading || resendCooldown > 0 || !email.trim()}
      >
        {resendLoading ? (
          <CircularProgress size={24} sx={{ color: '#894991' }} />
        ) : resendCooldown > 0 ? (
          `Renvoyer le code (${resendCooldown}s)`
        ) : (
          "Renvoyer le code"
        )}
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