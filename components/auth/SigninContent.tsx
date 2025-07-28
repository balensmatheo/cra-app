"use client";

import { useEffect, useState } from 'react';
import { TextField, Button, Typography, Alert, Box } from '@mui/material';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '@/components/auth/AuthLayout';

interface SigninContentProps {
  searchParams: URLSearchParams;
}

export default function SigninContent({ searchParams }: SigninContentProps) {
  const router = useRouter();
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
    console.log('🚀 DÉBUT DE LA CONNEXION pour:', email);
    setLoading(true);
    setError('');
    
    try {
      console.log('📞 Appel de signIn avec:', { username: email, password: '***' });
      const result = await signIn({ username: email, password });
      console.log('✅ SignIn terminé, résultat:', result);
      
      // Vérifier si l'utilisateur est vraiment connecté après signIn
      try {
        const currentUser = await getCurrentUser();
        console.log('👤 Utilisateur actuel après signIn:', currentUser);
        
        // Si nous arrivons ici, l'utilisateur est connecté et confirmé
        console.log('🎉 Utilisateur connecté et confirmé, rechargement de la page');
        window.location.reload();
        
      } catch (userErr: any) {
        console.log('⚠️ Erreur lors de la vérification de l\'utilisateur:', userErr);
        
        // Si getCurrentUser échoue après un signIn "réussi",
        // c'est probablement que l'utilisateur n'est pas confirmé
        console.log('🔄 UTILISATEUR NON CONFIRMÉ DÉTECTÉ - Redirection vers la page de confirmation');
        router.push(`/confirm?email=${encodeURIComponent(email)}&from=signin`);
        return;
      }
      
    } catch (err: any) {
      console.log('=== ERREUR DE CONNEXION - DIAGNOSTIC COMPLET ===');
      console.log('Type d\'erreur:', typeof err);
      console.log('Erreur de connexion - name:', err.name);
      console.log('Erreur de connexion - message:', err.message);
      console.log('Erreur de connexion - code:', err.code);
      console.log('Erreur de connexion - status:', err.status);
      console.log('Erreur de connexion - statusCode:', err.statusCode);
      console.log('Erreur de connexion - toString:', err.toString());
      console.log('Erreur de connexion - JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      console.log('=== FIN DIAGNOSTIC ===');
      
      // Vérifications d'erreur standards
      const errorString = err.toString().toLowerCase();
      const errorMessage = (err.message || '').toLowerCase();
      const errorName = (err.name || '').toLowerCase();
      const errorCode = (err.code || '').toLowerCase();
      
      const isUserNotConfirmed =
        err.name === 'UserNotConfirmedException' ||
        err.code === 'UserNotConfirmedException' ||
        errorMessage.includes('user is not confirmed') ||
        errorMessage.includes('not confirmed') ||
        errorMessage.includes('usernotconfirmedexception') ||
        errorString.includes('usernotconfirmedexception') ||
        errorName.includes('usernotconfirmed') ||
        errorCode.includes('usernotconfirmed') ||
        errorMessage.includes('unconfirmed') ||
        errorString.includes('unconfirmed');
      
      if (isUserNotConfirmed) {
        console.log('🔄 UTILISATEUR NON CONFIRMÉ DÉTECTÉ dans catch - Redirection vers la page de confirmation');
        router.push(`/confirm?email=${encodeURIComponent(email)}&from=signin`);
        return;
      }
      
      console.log('❌ Erreur de connexion standard:', err.message || err.toString());
      setError(err.message || err.toString());
    } finally {
      console.log('🏁 FIN DE LA TENTATIVE DE CONNEXION');
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading && email.trim() && password.trim()) {
      event.preventDefault();
      handleSignIn();
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
        onKeyDown={handleKeyDown}
        fullWidth
        disabled={loading}
        required
      />
      <TextField
        label="Mot de passe"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
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