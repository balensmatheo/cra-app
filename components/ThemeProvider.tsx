"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline, useMediaQuery } from '@mui/material';

type ModeSetting = 'system' | 'light' | 'dark';

type ColorModeContextType = {
  setting: ModeSetting;
  mode: 'light' | 'dark';
  setSetting: (s: ModeSetting) => void;
  cycleSetting: () => void; // system -> dark -> light -> system
};

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within AppThemeProvider');
  return ctx;
}

function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#894991' },
      secondary: { main: '#2e7d32' },
      background: mode === 'light'
        ? { default: '#fafafa', paper: '#ffffff' }
        : { default: '#0e0e10', paper: '#15151a' },
      divider: mode === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'
    },
    shape: { borderRadius: 10 },
    components: {
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 12 }
        }
      }
    }
  });
}

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const [setting, setSetting] = useState<ModeSetting>('system');

  // Load persisted preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme-setting') as ModeSetting | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setSetting(saved);
    } catch {}
  }, []);

  const mode: 'light' | 'dark' = useMemo(() => {
    if (setting === 'system') return prefersDark ? 'dark' : 'light';
    return setting;
  }, [setting, prefersDark]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  const setSettingPersist = useCallback((s: ModeSetting) => {
    setSetting(s);
    try { localStorage.setItem('theme-setting', s); } catch {}
  }, []);

  const cycleSetting = useCallback(() => {
    setSettingPersist(setting === 'system' ? 'dark' : setting === 'dark' ? 'light' : 'system');
  }, [setting, setSettingPersist]);

  const value = useMemo(() => ({ setting, mode, setSetting: setSettingPersist, cycleSetting }), [setting, mode, setSettingPersist, cycleSetting]);

  return (
    <ColorModeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
}
