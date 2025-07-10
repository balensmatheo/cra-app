"use client";
import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Profile from "../../../components/Profile";
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function ProfilePage() {
  const [user, setUser] = useState<{
    email: string;
    givenName: string;
    familyName: string;
    group: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthSession()
      .then(session => {
        const payload = session.tokens?.idToken?.payload || {};
        setUser({
          email: typeof payload.email === 'string' ? payload.email : '',
          givenName: typeof payload.given_name === 'string' ? payload.given_name : '',
          familyName: typeof payload.family_name === 'string' ? payload.family_name : '',
          group: Array.isArray(payload["cognito:groups"]) && typeof payload["cognito:groups"][0] === 'string' ? payload["cognito:groups"][0] : 'USERS',
        });
        setLoading(false);
      })
      .catch((err) => {
        setError('Impossible de charger la session utilisateur.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}><CircularProgress /></Box>;
  }
  if (error) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: 'red' }}>{error}</Box>;
  }
  if (!user) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: 'red' }}>Aucun utilisateur connecté.</Box>;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <Profile {...user} />
    </Box>
  );
} 