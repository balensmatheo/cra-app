"use client";
import { ReactNode, useRef } from 'react';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';

// Ensures Amplify is configured exactly once on client
export default function AmplifyProvider({ children }: { children: ReactNode }) {
  const configuredRef = useRef(false);
  if (!configuredRef.current) {
    Amplify.configure(outputs);
    configuredRef.current = true;
  }
  return <>{children}</>;
}
