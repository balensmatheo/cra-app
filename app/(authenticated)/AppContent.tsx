"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Box, TextField, Button, Typography, useTheme, IconButton, Snackbar, Alert } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { fetchAuthSession } from 'aws-amplify/auth';
import ActivityTable from "../../components/ActivityTable";
import { exportExcel } from "../../utils/exportExcel";
import { useDebounce } from "../../hooks/useDebounce";
import CRAHeader from "@/components/CRAHeader";
import CRASummary from "@/components/CRASummary";
import { useCRAEngine } from "../../hooks/useCRAEngine";
import { useCRA } from "@/context/CRAContext";
import { useCRAData } from "@/hooks/useCRAData";
import { type SectionKey } from "../../constants/categories";
import { CATEGORY_OPTIONS, SECTION_LABELS, NAME_DEBOUNCE_DELAY } from "../../constants/ui";
import { isFutureMonth, isDuplicateCategory } from "../../constants/validation";
import type { AppProps } from 'next/app';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getCurrentUser } from "aws-amplify/auth";
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';

const client = generateClient<Schema>();

const initialEmptyState = {
  categories: {
    facturees: [{ id: 1, label: "" }],
    non_facturees: [{ id: 1, label: "" }],
    autres: [{ id: 1, label: "" }],
  },
  data: {
    facturees: {},
    non_facturees: {},
    autres: {},
  }
};


export default function AppContent() {
  const { selectedMonth, selectMonth } = useCRA();
  const ownerIdRef = useRef<string | null>(null);
  const {
    categories,
    data,
    updateCell,
    updateComment,
    updateCategory,
    addCategory,
    deleteCategory,
    isLoading,
    isSaving,
    error,
    setError,
    snackbar,
    setSnackbar,
    fetchCRA,
    handleSave,
    resetState
  } = useCRAData(ownerIdRef.current, selectedMonth);
  
  const theme = useTheme();
  const [year, m] = selectedMonth.split("-").map(Number);
  const days = useMemo(() => {
    const date = new Date(year, m - 1, 1);
    const days = [];
    while (date.getMonth() === m - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [year, m]);
  const craEngine = useCRAEngine(categories, data, days);
  const { getRowTotal, getSectionTotal, getTotalWorkedDays, getBusinessDaysInMonth, canDeleteLastCategory } = craEngine;
  const hasInvalidCategory = useMemo(() =>
    Object.entries(categories).some(([section, cats]) =>
      cats.some(cat => {
        const row = data[section as SectionKey][cat.id] || {};
        const hasData = Object.entries(row).some(([k, v]) => k !== 'comment' && v) || row.comment;
        return hasData && !cat.label;
      })
    ), [categories, data]);
  const [userGivenName, setUserGivenName] = useState("");
  const [userFamilyName, setUserFamilyName] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  // Récupérer ownerId et infos utilisateur une seule fois
  useEffect(() => {
    fetchAuthSession().then(session => {
      const payload = session.tokens?.idToken?.payload || {};
      setUserGivenName(typeof payload.given_name === 'string' ? payload.given_name : "");
      setUserFamilyName(typeof payload.family_name === 'string' ? payload.family_name : "");
      setUserEmail(typeof payload.email === 'string' ? payload.email : "");
      ownerIdRef.current = typeof payload.sub === 'string' ? payload.sub : null;
      setIsUserLoaded(true);
    });
  }, []);

  const handleCellChange = useCallback((section: SectionKey, catId: number, date: string, value: string) => {
    updateCell(section, catId, date, value);
  }, [updateCell]);
  const handleCategoryLabelChange = useCallback((section: SectionKey, catId: number, value: string) => {
    updateCategory(section, catId, value);
  }, [updateCategory]);
  const handleCommentChange = useCallback((section: SectionKey, catId: number, value: string) => {
    updateComment(section, catId, value);
  }, [updateComment]);
  const handleAddCategory = useCallback((section: SectionKey) => {
    addCategory(section);
  }, [addCategory]);
  const handleDeleteCategory = useCallback((section: SectionKey, catId: number) => {
    if (!canDeleteLastCategory(section)) {
      setSnackbar({
        open: true,
        message: 'Impossible de supprimer la dernière ligne non vide',
        severity: 'error'
      });
      return;
    }
    deleteCategory(section, catId);
  }, [deleteCategory, canDeleteLastCategory]);
  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, monthValue] = e.target.value.split('-').map(Number);
    selectMonth(monthValue - 1);
  }, [selectMonth]);
  const handleExport = useCallback(() => {
    if (hasInvalidCategory) {
      setSnackbar({
        open: true,
        message: "Une catégorie ne peut pas être vide si la ligne contient des données.",
        severity: 'error'
      });
      return;
    }
    setError(null);
    exportExcel({
      name: userGivenName + " " + userFamilyName,
      month: selectedMonth,
      days,
      categories,
      data
    });
    setSnackbar({
      open: true,
      message: 'Export Excel généré avec succès !',
      severity: 'success'
    });
  }, [hasInvalidCategory, userGivenName, userFamilyName, selectedMonth, days, categories, data]);
  const totalDays = getTotalWorkedDays();
  const businessDaysInMonth = getBusinessDaysInMonth();
  const tableRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>> = {
    facturees: useRef<HTMLDivElement>(null),
    non_facturees: useRef<HTMLDivElement>(null),
    autres: useRef<HTMLDivElement>(null),
  };
  const handleSyncScroll = useCallback((sectionKey: SectionKey) => (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    Object.entries(tableRefs).forEach(([key, ref]) => {
      if (key !== sectionKey && ref.current) {
        ref.current.scrollLeft = scrollLeft;
      }
    });
  }, [tableRefs]);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const allTableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const handleGlobalZoom = useCallback((newZoom: number) => {
    setGlobalZoom(newZoom);
    allTableRefs.current.forEach(ref => {
      if (ref) {
        ref.style.zoom = newZoom.toString();
      }
    });
  }, []);
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);
  const createSectionHandlers = useCallback((sectionKey: SectionKey) => ({
    onCategoryChange: (catId: number, value: string) => handleCategoryLabelChange(sectionKey, catId, value),
    onCellChange: (catId: number, date: string, value: string) => handleCellChange(sectionKey, catId, date, value),
    onAddCategory: () => handleAddCategory(sectionKey),
    onDeleteCategory: (catId: number) => handleDeleteCategory(sectionKey, catId),
    onCommentChange: (catId: number, value: string) => handleCommentChange(sectionKey, catId, value),
    getRowTotal: (catId: number) => getRowTotal(sectionKey, catId),
    getSectionTotal: () => getSectionTotal(sectionKey),
  }), [handleCategoryLabelChange, handleCellChange, handleAddCategory, handleDeleteCategory, handleCommentChange, getRowTotal, getSectionTotal]);
  const activityTableProps = useMemo(() => 
    SECTION_LABELS.map(({ key, label }, index) => {
      const sectionKey = key as SectionKey;
      const handlers = createSectionHandlers(sectionKey);
      return {
        sectionKey,
        label,
        days,
        categories: categories[sectionKey],
        data: data[sectionKey],
        categoryOptions: CATEGORY_OPTIONS[sectionKey],
        tableRef: (el: HTMLDivElement | null) => {
          allTableRefs.current[index] = el;
          tableRefs[sectionKey].current = el;
          if (el) {
            el.style.zoom = globalZoom.toString();
          }
        },
        onTableScroll: handleSyncScroll(sectionKey),
        ...handlers
      };
    }), [SECTION_LABELS, days, categories, data, createSectionHandlers, globalZoom, tableRefs, handleSyncScroll]);

  return (
    <Box
      sx={{
        width: isFullscreen ? "100%" : { xs: "100%", md: "95%" },
        maxWidth: isFullscreen ? "100%" : 1900,
        margin: isFullscreen ? 0 : { xs: 0, md: "40px auto 0 auto" },
        background: "#fff",
        borderRadius: isFullscreen ? 0 : { xs: 0, md: 2 },
        boxShadow: isFullscreen ? "none" : { xs: "none", md: "0 4px 24px rgba(0,0,0,0.08)" },
        p: isFullscreen ? 2 : { xs: 2, md: 4 },
        minHeight: isFullscreen ? "100vh" : 400,
        position: 'relative'
      }}
    >
      {!isFullscreen && (
        <CRAHeader
          userFamilyName={userFamilyName}
          userGivenName={userGivenName}
          selectedMonth={selectedMonth}
          handleMonthChange={handleMonthChange}
          fetchCRA={fetchCRA}
          handleSave={() => handleSave(hasInvalidCategory)}
          isLoadingCRA={isLoading || isSaving}
          ownerId={ownerIdRef.current}
          handleExport={handleExport}
          toggleFullscreen={toggleFullscreen}
        />
      )}
      {/* Barre d'outils en mode plein écran */}
      {isFullscreen && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          p: 2,
          background: '#f8f9fa',
          borderRadius: 1,
          border: '1px solid #e9ecef'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: "#894991", fontWeight: 600 }}>
              {userGivenName + " " + userFamilyName} - {selectedMonth}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => handleGlobalZoom(Math.max(0.3, globalZoom - 0.1))}
              sx={{ color: '#666' }}
              title="Zoom -"
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" sx={{ color: '#666', fontSize: '0.9rem', minWidth: '40px', textAlign: 'center' }}>
              {Math.round(globalZoom * 100)}%
            </Typography>
            <IconButton
              size="small"
              onClick={() => handleGlobalZoom(Math.min(2, globalZoom + 0.1))}
              sx={{ color: '#666' }}
              title="Zoom +"
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleGlobalZoom(1)}
              sx={{
                fontSize: '0.7rem',
                borderColor: '#ccc',
                color: '#666',
                ml: 1
              }}
            >
              Reset
            </Button>
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              sx={{ color: '#666', ml: 1 }}
              title="Quitter le plein écran"
            >
              <FullscreenExitIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2, my: 4 }} />
      ) : (
        activityTableProps.map((props, index) => (
          <ActivityTable key={SECTION_LABELS[index].key} {...props} />
        ))
      )}
      {!isFullscreen && (
        <CRASummary
          totalDays={totalDays}
          businessDaysInMonth={businessDaysInMonth}
          saved={!isSaving && !error}
          error={error || ""}
        />
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}