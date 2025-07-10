"use client";

import { useState, useEffect } from "react";
import Signin from "../../components/Signin";
import { getCurrentUser } from "aws-amplify/auth";
import AppContent from "./AppContent";
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';

Amplify.configure(outputs);

export default function Home() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then(() => { if (mounted) { setIsAuthenticated(true); setAuthChecked(true); } })
      .catch(() => { if (mounted) { setIsAuthenticated(false); setAuthChecked(true); } });
    return () => { mounted = false; };
  }, []);

  if (!authChecked) return null;
  return <Signin>{isAuthenticated && <AppContent />}</Signin>;
}
