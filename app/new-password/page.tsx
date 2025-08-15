"use client";
import { Suspense, useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, confirmSignIn, updateUserAttributes } from 'aws-amplify/auth';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordConstraints, { validatePassword } from '@/components/auth/PasswordConstraints';

function NewPasswordContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get('email') || '');
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    // Pre-fill from sessionStorage if available
    try {
      if (typeof window !== 'undefined') {
        const e = sessionStorage.getItem('np_email');
        const t = sessionStorage.getItem('np_temp');
        if (e && !email) setEmail(e);
        if (t) setTempPassword(t);
      }
    } catch {}
  }, []);

  const handleSubmit = async () => {
    if (newPassword !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!validatePassword(newPassword)) {
      setError('Le mot de passe ne respecte pas toutes les contraintes requises.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez renseigner votre prénom et votre nom.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      // If we already have a sessionStorage temp password, we can assume the step has been set by the prior signIn
      // but to be safe, call signIn again with the temp password to ensure challenge context exists.
      const result = await signIn({ username: email, password: tempPassword });
      const step = (result as any)?.nextStep?.signInStep;
      if (step !== 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' && step !== 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD') {
        setInfo("Aucun nouveau mot de passe requis. Vous êtes peut-être déjà connecté ou le mot de passe n'est pas temporaire.");
        return;
      }
      // Provide required attributes during the NEW_PASSWORD_REQUIRED challenge
      await confirmSignIn({
        challengeResponse: newPassword,
        options: {
          userAttributes: {
            given_name: firstName,
            family_name: lastName,
            name: `${firstName} ${lastName}`,
          },
        },
      });
      // Set user attributes (first/last name) once signed in
      try {
        await updateUserAttributes({ userAttributes: {
          given_name: firstName,
          family_name: lastName,
          name: `${firstName} ${lastName}`,
        }});
      } catch {}
      // Clean session storage
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('np_email');
          sessionStorage.removeItem('np_temp');
        }
      } catch {}
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
      router.replace(`/cra/${ym}?user=me`);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Définir un nouveau mot de passe">
      <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', mb: 1 }}>
        Saisissez l'adresse email, le mot de passe temporaire reçu et choisissez un nouveau mot de passe.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {info && <Alert severity="info" sx={{ mb: 1 }}>{info}</Alert>}
      <form onSubmit={(e)=>{ e.preventDefault(); if (!loading) handleSubmit(); }}>
        <TextField label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} fullWidth disabled={loading} />
        {tempPassword ? null : (
          <TextField label="Mot de passe temporaire" type="password" value={tempPassword} onChange={e=>setTempPassword(e.target.value)} fullWidth disabled={loading} />
        )}
        <TextField label="Nouveau mot de passe" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} fullWidth disabled={loading} />
        <PasswordConstraints password={newPassword} />
        <TextField label="Confirmer le mot de passe" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} fullWidth disabled={loading} />
        <TextField label="Prénom" value={firstName} onChange={e=>setFirstName(e.target.value)} fullWidth disabled={loading} />
        <TextField label="Nom" value={lastName} onChange={e=>setLastName(e.target.value)} fullWidth disabled={loading} />
        <Button
          type="submit"
          variant="contained"
          disabled={
            loading ||
            !email.trim() ||
            !tempPassword.trim() ||
            !newPassword.trim() ||
            !validatePassword(newPassword) ||
            !confirm.trim() ||
            newPassword !== confirm ||
            !firstName.trim() ||
            !lastName.trim()
          }
          sx={{ background:'#894991', '&:hover':{ background:'#6a3a7a' }, width:'100%', fontWeight:600 }}
        >
          {loading ? <CircularProgress size={24} sx={{ color:'#fff' }} /> : 'Valider'}
        </Button>
      </form>
      <Button variant="text" onClick={()=>router.push('/signin')} sx={{ color:'#894991', textTransform:'none', width:'100%' }}>Retour</Button>
    </AuthLayout>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <CircularProgress size={48} sx={{ color: '#894991' }} />
      </Box>
    }>
      <NewPasswordContent />
    </Suspense>
  );
}
