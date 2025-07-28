"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';

interface SearchParamsWrapperProps {
  children: (searchParams: URLSearchParams) => React.ReactNode;
  fallback?: React.ReactNode;
}

function SearchParamsProvider({ children }: { children: (searchParams: URLSearchParams) => React.ReactNode }) {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
}

export default function SearchParamsWrapper({ children, fallback }: SearchParamsWrapperProps) {
  const defaultFallback = (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#f8f9fa' 
    }}>
      <CircularProgress size={48} sx={{ color: '#894991' }} />
    </Box>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <SearchParamsProvider>
        {children}
      </SearchParamsProvider>
    </Suspense>
  );
}