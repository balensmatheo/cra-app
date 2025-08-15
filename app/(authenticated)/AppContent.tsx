"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CRAHeader from '@/components/CRAHeader';
import ActivityTable from '@/components/ActivityTable';
import TopKPI from '@/components/TopKPI';
import { useCRA } from '@/context/CRAContext';
import { useCraGrid } from '@/hooks/useCraGrid';
import { CATEGORY_OPTIONS, SECTION_LABELS } from '@/constants/ui';
import { type SectionKey } from '@/constants/categories';
import { exportExcel } from '@/utils/exportExcel';
import { getBusinessDaysCount } from '@/utils/businessDays';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

export default function AppContent() {
  const { selectedMonth, setMonthString, isFullscreen, setIsFullscreen, resolvedTargetSub, currentUserSub } = useCRA();
  const dataClient = useMemo(() => generateClient<Schema>(), []);
  const fullRef = useRef<HTMLDivElement | null>(null);
  const ownerIdRef = useRef<string | null>(null);

  const {
    categories,
    data,
    updateCell,
    updateComment,
    updateCategory,
    addCategory,
    deleteCategory,
    status,
    saveDraft,
    validateCra,
    closeCra,
    reopenCra,
    computeValidation,
    readOnly,
    isLoading,
    lastSavedAt,
    resetAll,
    isDirty,
    pendingMatrix,
    pendingComments,
    isAdmin,
    isSaving: isSavingCra,
  } = useCraGrid(selectedMonth, resolvedTargetSub);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'success'|'error'|'info' });
  const [userFamilyName, setUserFamilyName] = useState('');
  const [userGivenName, setUserGivenName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);

  // Sync horizontal scroll across the three tables
  const tableContainersRef = useRef<Array<HTMLDivElement | null>>([]);
  const isSyncingRef = useRef(false);
  const registerTableRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    tableContainersRef.current[index] = el;
  }, []);
  const handleSynchronizedScroll = useCallback((sourceIndex: number) => (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) return;
    const src = e.currentTarget as HTMLDivElement;
    const targetScrollLeft = src.scrollLeft;
    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      tableContainersRef.current.forEach((el, idx) => {
        if (!el || idx === sourceIndex) return;
        if (el.scrollLeft !== targetScrollLeft) {
          el.scrollLeft = targetScrollLeft;
        }
      });
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        ownerIdRef.current = (user as any)?.userId || null;
        try {
          const { tokens } = await fetchAuthSession();
          const payload: any = tokens?.idToken?.payload ?? {};
          const given = payload?.given_name || payload?.givenName || '';
          const family = payload?.family_name || payload?.familyName || '';
          if (typeof given === 'string') setUserGivenName(given);
          if (typeof family === 'string') setUserFamilyName(family);
        } catch {}
      } catch {}
    })();
  }, []);

  // When viewing another user's CRA, fetch their profile (name) via admin getUser
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const target = resolvedTargetSub;
      if (!target) return;
      // If target is self, keep current token names
      if (currentUserSub && target === currentUserSub) return;
      try {
        const { data, errors } = await dataClient.queries.getUser({ sub: target });
        if (errors) throw new Error(errors[0]?.message || 'getUser error');
        const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
        const u = payload?.user;
        if (!cancelled && u) {
          setUserGivenName(u.given_name || '');
          setUserFamilyName(u.family_name || '');
        }
      } catch (e) {
        // ignore, keep existing names
        console.warn('[CRA] getUser failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [resolvedTargetSub, currentUserSub, dataClient]);

  const days = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const arr: Date[] = [];
    const d = new Date(y, m - 1, 1);
    while (d.getMonth() === m - 1) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [selectedMonth]);

  const sectionTotals = useMemo(() => {
    const totals: Record<SectionKey, number> = { facturees: 0, non_facturees: 0, autres: 0 } as any;
    (Object.keys(categories) as SectionKey[]).forEach(section => {
      const rows = categories[section];
      rows.forEach(r => {
        const rowData = data[section][r.id] || {};
        const sum = days.reduce((acc, d) => {
          const v = rowData[d.toISOString().slice(0,10)];
          const n = v ? parseFloat(v) : 0;
          return acc + (isNaN(n) ? 0 : n);
        }, 0);
        totals[section] += sum;
      });
    });
    return totals;
  }, [categories, data, days]);

  const businessDaysInMonth = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return getBusinessDaysCount(y, m - 1);
  }, [selectedMonth]);

  const invalidDays = useMemo(() => {
    const set = new Set<string>();
    days.forEach((d) => {
      const dayKey = d.toISOString().slice(0,10);
      let sum = 0;
      (Object.keys(data) as SectionKey[]).forEach((section) => {
        const rows = data[section] as Record<number, Record<string, string | undefined>>;
        Object.values(rows).forEach((row) => {
          const v = row?.[dayKey];
          const n = v ? parseFloat(v) : 0;
          if (!isNaN(n)) sum += n;
        });
      });
      if (sum > 1.0001) set.add(dayKey);
    });
    return set;
  }, [data, days]);

  const totalsByDay = useMemo(() => {
    const totals: Record<string, number> = {};
    days.forEach((d) => {
      const dayKey = d.toISOString().slice(0,10);
      let sum = 0;
      (Object.keys(data) as SectionKey[]).forEach((section) => {
        const rows = data[section] as Record<number, Record<string, string | undefined>>;
        Object.values(rows).forEach((row) => {
          const v = row?.[dayKey];
          const n = v ? parseFloat(v) : 0;
          if (!isNaN(n)) sum += n;
        });
      });
      totals[dayKey] = sum;
    });
    return totals;
  }, [data, days]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{4}-\d{2}$/.test(value)) {
      setMonthString(value);
    }
  };

  // Fullscreen controls using the native Fullscreen API
  const enterFullscreen = useCallback(() => {
    const el: any = fullRef.current;
    if (!el) return;
    const req = el.requestFullscreen || (el as any).webkitRequestFullscreen || (el as any).msRequestFullscreen;
    if (req) {
      try { req.call(el); } catch {}
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    const doc: any = document as any;
    const exit = doc.exitFullscreen || (doc as any).webkitExitFullscreen || (doc as any).msExitFullscreen;
    if (exit) {
      try { exit.call(doc); } catch {}
    }
    setIsFullscreen(false);
  }, [setIsFullscreen]);

  const toggleFullscreenNative = useCallback(() => {
    const d: any = document as any;
    if (d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const onChange = () => {
      const d: any = document as any;
      const active = !!(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement);
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange as any);
    document.addEventListener('MSFullscreenChange', onChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange as any);
      document.removeEventListener('MSFullscreenChange', onChange as any);
    };
  }, [setIsFullscreen]);

  const getRowTotal = (section: SectionKey, rowId: number) => {
    const rowData = data[section][rowId] || {};
    return days.reduce((acc, d) => {
      const v = rowData[d.toISOString().slice(0,10)];
      const n = v ? parseFloat(v) : 0;
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
  };

  const getSectionTotal = (section: SectionKey) => sectionTotals[section] || 0;

  const handleSave = async () => {
    await saveDraft();
    setSnackbar({ open: true, message: 'CRA enregistré', severity: 'success' });
  };

  const { ok, errors } = computeValidation();
  const disableSubmit = !ok || isDirty;
  const disableSubmitReason = (() => {
    if (isDirty) return "Enregistrez d'abord vos modifications.";
    if (ok) return '';
    const shown = errors.slice(0, 4);
    const more = errors.length - shown.length;
    const list = shown.map(e => `• ${e}`).join('  ');
    return more > 0 ? `${list}  • +${more} autre(s)…` : list;
  })();

  const handleSubmit = async () => {
    setSubmitting(true);
    const success = await validateCra();
    setSnackbar({ open: true, message: success ? 'CRA validé' : 'Échec validation', severity: success ? 'success' : 'error' });
    setSubmitting(false);
  };

  const handleCloseCra = async () => {
    setClosing(true);
    const success = await closeCra();
    setSnackbar({ open: true, message: success ? 'CRA clôturé' : 'Échec clôture', severity: success ? 'success' : 'error' });
    setClosing(false);
  };

  const handleExport = async () => {
    setExporting(true);
    const name = [userGivenName, userFamilyName].filter(Boolean).join(' ') || 'Utilisateur';
    await exportExcel({ name, month: selectedMonth, days, categories: categories as any, data: data as any });
    setExporting(false);
  };

  const handleReopen = async () => {
    setReopening(true);
    const ok = await reopenCra();
    setSnackbar({ open: true, message: ok ? 'CRA ré-ouvert pour modification' : 'Impossible de ré-ouvrir ce CRA', severity: ok ? 'success' : 'error' });
    setReopening(false);
  };

  const activityTableProps = SECTION_LABELS.map(({ key, label }, idx) => ({
    sectionKey: key,
    label,
    days,
    categories: categories[key],
    data: data[key] as any,
    totalsByDay,
    categoryOptions: CATEGORY_OPTIONS[key],
    onCategoryChange: (rowId: number, value: string) => updateCategory(key, rowId, value),
    onCellChange: (rowId: number, date: string, value: string) => updateCell(key, rowId, date, value),
    onAddCategory: () => addCategory(key),
    onDeleteCategory: (rowId: number) => deleteCategory(key, rowId),
    getRowTotal: (rowId: number) => getRowTotal(key, rowId),
    getSectionTotal: () => getSectionTotal(key),
    onCommentChange: (rowId: number, value: string) => updateComment(key, rowId, value),
    readOnly,
    pendingMatrix: pendingMatrix[key],
    pendingComments: pendingComments[key],
    invalidDays,
    tableRef: registerTableRef(idx),
    onTableScroll: handleSynchronizedScroll(idx),
  }));

  return (
    <Box ref={fullRef}
      sx={{
        width: '100%',
        maxWidth: '100%',
        margin: isFullscreen ? 0 : '0 auto',
        background: '#fff',
        borderRadius: isFullscreen ? 0 : { xs: 0, md: 2 },
        boxShadow: isFullscreen ? 'none' : { xs: 'none', md: '0 4px 24px rgba(0,0,0,0.08)' },
        p: isFullscreen ? 2 : { xs: 2, md: 4 },
        minHeight: isFullscreen ? '100vh' : 400,
        position: 'relative',
      }}
    >
      {isFullscreen && (
        <Button
          variant="outlined"
          startIcon={<FullscreenExitIcon />}
          onClick={exitFullscreen}
          size="small"
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            borderColor: '#ccc',
            color: '#666',
            textTransform: 'none',
            zIndex: 2000,
            '&:hover': { borderColor: '#894991', color: '#894991' }
          }}
        >
          Quitter le plein écran
        </Button>
      )}

      {!isFullscreen && (
        <TopKPI
          facturees={sectionTotals.facturees}
          businessDays={businessDaysInMonth}
        />
      )}

      {!isFullscreen && (
        <CRAHeader
          userFamilyName={userFamilyName}
          userGivenName={userGivenName}
          selectedMonth={selectedMonth}
          handleMonthChange={handleMonthChange}
          handleSave={handleSave}
          handleSubmit={handleSubmit}
          isLoadingCRA={isLoading}
          ownerId={ownerIdRef.current}
          handleExport={handleExport}
          toggleFullscreen={toggleFullscreenNative}
          statusBadge={{ status, readOnly }}
          validationState={{ ok, errors }}
          lastSavedAt={lastSavedAt}
          onResetAll={() => resetAll()}
          dirty={isDirty}
          disableSubmit={disableSubmit}
          disableSubmitReason={disableSubmitReason}
          onCloseCra={isAdmin ? handleCloseCra : undefined}
          canClose={isAdmin && status === 'validated'}
          saving={!!isSavingCra}
          submitting={submitting}
          exporting={exporting}
          closing={closing}
          reopening={reopening}
          onReopen={status === 'validated' ? handleReopen : undefined}
        />
      )}

      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2, my: 4 }} />
      ) : (
        activityTableProps.map((props, index) => (
          <ActivityTable key={SECTION_LABELS[index].key} {...props} />
        ))
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
