"use client";

import { useState } from 'react';
import { TextField, Button, Typography } from '@mui/material';
import { signUp } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '@/components/auth/AuthLayout';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);
    if (!givenName.trim() || !familyName.trim()) {
      setError('Merci de renseigner votre prénom et votre nom.');
      setLoading(false);
      return;
    }
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            family_name: familyName,
            given_name: givenName,
          },
        }
      });
      router.push(`/confirm?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Créer un compte">
      <TextField
        label="Prénom"
        value={givenName}
        onChange={e => setGivenName(e.target.value)}
        fullWidth
        disabled={loading}
        required
      />
      <TextField
        label="Nom"
        value={familyName}
        onChange={e => setFamilyName(e.target.value)}
        fullWidth
        disabled={loading}
        required
      />
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
        onClick={handleSignUp}
        sx={{
          background: (!givenName.trim() || !familyName.trim() || !email.trim() || !password.trim() || loading) ? '#ccc' : '#894991',
          color: (!givenName.trim() || !familyName.trim() || !email.trim() || !password.trim() || loading) ? '#888' : '#fff',
          '&:hover': {
            background: (!givenName.trim() || !familyName.trim() || !email.trim() || !password.trim() || loading) ? '#ccc' : '#6a3a7a',
          },
          fontWeight: 600,
          textTransform: 'none',
          width: '100%',
        }}
        disabled={loading || !givenName.trim() || !familyName.trim() || !email.trim() || !password.trim()}
      >
        {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "S'inscrire"}
      </Button>
      <Button
        variant="text"
        onClick={() => router.push('/signin')}
        sx={{ color: '#894991', textTransform: 'none', width: '100%' }}
        disabled={loading}
      >
        Se connecter
      </Button>
    </AuthLayout>
  );
}