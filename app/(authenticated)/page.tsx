"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import AppContent from "./AppContent";
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';
import { Box, CircularProgress } from '@mui/material';

Amplify.configure(outputs);

// Force dynamic rendering to prevent static generation issues with auth checks
export const dynamic = 'force-dynamic';

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then(() => {
        if (mounted) {
          setIsAuthenticated(true);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsAuthenticated(false);
          setAuthChecked(true);
          router.push('/signin');
        }
      });
    return () => { mounted = false; };
  }, [router]);

  if (!authChecked) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <CircularProgress size={48} sx={{ color: '#894991' }} />
      </Box>
    );
  }

  return isAuthenticated ? <AppContent /> : null;
}
