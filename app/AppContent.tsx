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
import RefreshIcon from '@mui/icons-material/Refresh';
import { fetchAuthSession } from 'aws-amplify/auth';
import Navbar from "../components/Navbar";
import ActivityTable from "../components/ActivityTable";
import { exportExcel } from "../utils/exportExcel";
import { useDebounce } from "../hooks/useDebounce";
import { useCRAEngine } from "../hooks/useCRAEngine";
import { useCRAState, type Category, type CategoriesState, type DataState } from "../hooks/useCRAState";
import { type SectionKey } from "../constants/categories";
import { CATEGORY_OPTIONS, SECTION_LABELS, NAME_DEBOUNCE_DELAY } from "../constants/ui";
import { isFutureMonth, isDuplicateCategory } from "../constants/validation";
import type { AppProps } from 'next/app';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import { getCurrentUser } from "aws-amplify/auth";
import Skeleton from '@mui/material/Skeleton';

export default function AppContent() {
  const today = new Date();
  const [name, setName] = useState("");
  const [localName, setLocalName] = useState("");
  const debouncedLocalName = useDebounce(localName, NAME_DEBOUNCE_DELAY);
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const {
    categories,
    data,
    updateCell,
    updateComment,
    updateCategory,
    addCategory,
    deleteCategory,
    loadState,
  } = useCRAState();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const theme = useTheme();
  const [year, m] = month.split("-").map(Number);
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
  useEffect(() => {
    setLocalName(name);
  }, [name]);
  useEffect(() => {
    if (debouncedLocalName !== name) {
      setName(debouncedLocalName);
    }
  }, [debouncedLocalName, name]);
  useEffect(() => {
    async function fetchCRA() {
      if (!name.trim()) {
        return;
      }
      try {
        const user = await getCurrentUser();
        const ownerIdLoad: string = (user?.username || user?.signInDetails?.loginId || "");
        if (!ownerIdLoad) throw new Error("Impossible de récupérer l'utilisateur connecté");
        const ownerIdStr: string = String(ownerIdLoad);
        const [year, monthNum] = month.split("-").map(Number);
        
        const { data: exists } = await client.models.CRA.list({
          filter: {
            owner: { eq: ownerIdLoad },
            year: { eq: year },
            month: { eq: monthNum }
          }
        });
        if (exists && exists.length > 0) {
          // @ts-expect-error Typage généré trop strict, ownerIdLoad est bien une string ici
          const parsed = JSON.parse(exists[0].dailyEntries);
          loadState(parsed);
          setSaved(true);
        } else {
          loadState({
            categories: {
              facturees: [{ id: 1, label: "" }],
              non_facturees: [{ id: 1, label: "" }],
              autres: [{ id: 1, label: "" }],
            },
            data: { facturees: {}, non_facturees: {}, autres: {} },
          });
          setSaved(false);
        }
      } catch (err) {
        loadState({
          categories: {
            facturees: [{ id: 1, label: "" }],
            non_facturees: [{ id: 1, label: "" }],
            autres: [{ id: 1, label: "" }],
          },
          data: { facturees: {}, non_facturees: {}, autres: {} },
        });
        setSaved(false);
      }
    }
    fetchCRA();
    // eslint-disable-next-line
  }, [name, month, loadState]);
  const handleCellChange = useCallback((section: SectionKey, catId: number, date: string, value: string) => {
    updateCell(section, catId, date, value);
    setSaved(false);
  }, [updateCell]);
  const handleCategoryLabelChange = useCallback((section: SectionKey, catId: number, value: string) => {
    updateCategory(section, catId, value);
    setSaved(false);
  }, [updateCategory]);
  const handleCommentChange = useCallback((section: SectionKey, catId: number, value: string) => {
    updateComment(section, catId, value);
    setSaved(false);
  }, [updateComment]);
  const handleAddCategory = useCallback((section: SectionKey) => {
    addCategory(section);
    setSaved(false);
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
    setSaved(false);
  }, [deleteCategory, canDeleteLastCategory]);
  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMonth = e.target.value;
    setMonth(newMonth);
  }, []);
  const handleSave = useCallback(async () => {
    if (!name) {
      setSnackbar({
        open: true,
        message: 'Merci de renseigner votre nom.',
        severity: 'error'
      });
      return;
    }
    if (hasInvalidCategory) {
      setSnackbar({
        open: true,
        message: "Une catégorie ne peut pas être vide si la ligne contient des données.",
        severity: 'error'
      });
      return;
    }
    setError("");
    try {
      const user = await getCurrentUser();
      const ownerId = user?.username || user?.signInDetails?.loginId;
      if (!ownerId) throw new Error("Impossible de récupérer l'utilisateur connecté");
      const [year, monthNum] = month.split("-").map(Number);
      const dailyEntriesJSON = JSON.stringify({ categories, data });
      const { data: exists } = await client.models.CRA.list({
        filter: {
          owner: { eq: ownerId },
          year: { eq: year },
          month: { eq: monthNum }
        }
      });
      if (exists && exists.length > 0) {
        const existing = exists[0];
        await client.models.CRA.update({
          id: existing.id,
          dailyEntries: dailyEntriesJSON
        }, { authMode: 'userPool' });
      } else {
        await client.models.CRA.create({
          owner: ownerId,
          year,
          month: monthNum,
          dailyEntries: dailyEntriesJSON
        }, { authMode: 'userPool' });
      }
      setSaved(true);
      setSnackbar({
        open: true,
        message: 'Compte rendu sauvegardé sur le cloud !',
        severity: 'success'
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde du CRA');
      setSnackbar({
        open: true,
        message: err.message || 'Erreur lors de la sauvegarde du CRA',
        severity: 'error'
      });
    }
  }, [name, hasInvalidCategory, categories, data, month]);
  const handleReset = useCallback(() => {
    if (!name) {
      setSnackbar({
        open: true,
        message: 'Merci de renseigner votre nom.',
        severity: 'error'
      });
      return;
    }
    loadState({
      categories: {
        facturees: [{ id: 1, label: "" }],
        non_facturees: [{ id: 1, label: "" }],
        autres: [{ id: 1, label: "" }],
      },
      data: { facturees: {}, non_facturees: {}, autres: {} },
    });
    setSaved(false);
    setSnackbar({
      open: true,
      message: 'Données réinitialisées !',
      severity: 'success'
    });
  }, [name, loadState]);
  const handleExport = useCallback(() => {
    if (hasInvalidCategory) {
      setSnackbar({
        open: true,
        message: "Une catégorie ne peut pas être vide si la ligne contient des données.",
        severity: 'error'
      });
      return;
    }
    setError("");
    exportExcel({
      name,
      month,
      days,
      categories,
      data
    });
    setSnackbar({
      open: true,
      message: 'Export Excel généré avec succès !',
      severity: 'success'
    });
  }, [hasInvalidCategory, name, month, days, categories, data]);
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  }, []);
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
  const [userEmail, setUserEmail] = useState<string>("");
  const [userGivenName, setUserGivenName] = useState("");
  const [userFamilyName, setUserFamilyName] = useState("");
  const client = generateClient<Schema>();


  useEffect(() => {
    fetchAuthSession().then(session => {
      const payload = session.tokens?.idToken?.payload || {};
      setUserGivenName(typeof payload.given_name === 'string' ? payload.given_name : "");
      setUserFamilyName(typeof payload.family_name === 'string' ? payload.family_name : "");
    });
  }, []);

  return (
    <Box sx={{ 
      minHeight: "100vh", 
      background: "#f5f5f5",
      position: isFullscreen ? 'fixed' : 'relative',
      top: isFullscreen ? 0 : 'auto',
      left: isFullscreen ? 0 : 'auto',
      right: isFullscreen ? 0 : 'auto',
      bottom: isFullscreen ? 0 : 'auto',
      zIndex: isFullscreen ? 9999 : 'auto',
      overflow: isFullscreen ? 'auto' : 'visible'
    }}>
      <Navbar />
      <Box
        sx={{
          width: isFullscreen ? "100%" : "95%",
          maxWidth: isFullscreen ? "100%" : 1900,
          margin: isFullscreen ? 0 : "40px auto 0 auto",
          background: "#fff",
          borderRadius: isFullscreen ? 0 : 2,
          boxShadow: isFullscreen ? "none" : "0 4px 24px rgba(0,0,0,0.08)",
          p: isFullscreen ? 2 : 4,
          minHeight: isFullscreen ? "100vh" : 400,
          position: 'relative'
        }}
      >
        {!isFullscreen && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <Typography variant="body1" sx={{ minWidth: 200, fontWeight: 700, color: '#894991', fontSize: '1rem', letterSpacing: 0.5 }}>
                {userFamilyName && userGivenName
                  ? `${userGivenName} ${userFamilyName} `
                  : <Skeleton variant="text" width={160} height={32} sx={{ bgcolor: '#eee', borderRadius: 1, display: 'inline-block' }} />
                }
              </Typography>
              <TextField
                label="Mois"
                type="month"
                value={month}
                onChange={handleMonthChange}
                sx={{ minWidth: 140 }}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem' }}>
                  Zoom: 
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleGlobalZoom(Math.max(0.5, globalZoom - 0.1))}
                  sx={{ 
                    minWidth: 'auto', 
                    px: 1, 
                    py: 0.5, 
                    fontSize: '0.7rem',
                    borderColor: '#ccc',
                    color: '#666'
                  }}
                >
                  -
                </Button>
                <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem', minWidth: '30px', textAlign: 'center' }}>
                  {Math.round(globalZoom * 100)}%
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleGlobalZoom(Math.min(1.5, globalZoom + 0.1))}
                  sx={{ 
                    minWidth: 'auto', 
                    px: 1, 
                    py: 0.5, 
                    fontSize: '0.7rem',
                    borderColor: '#ccc',
                    color: '#666'
                  }}
                >
                  +
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleGlobalZoom(1)}
                  sx={{ 
                    minWidth: 'auto', 
                    px: 1, 
                    py: 0.5, 
                    fontSize: '0.7rem',
                    borderColor: '#ccc',
                    color: '#666'
                  }}
                >
                  Reset
                </Button>
              </Box>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon fontSize="small" />}
                onClick={handleReset}
                size="small"
                sx={{
                  fontSize: 14,
                  px: 2,
                  py: 0.5,
                  borderColor: '#ff9800',
                  color: '#ff9800',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#f57c00', color: '#f57c00' }
                }}
              >
                Réinitialiser
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon fontSize="small" />}
                onClick={handleSave}
                size="small"
                sx={{
                  fontSize: 14,
                  px: 2,
                  py: 0.5,
                  backgroundColor: "#894991",
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#6a3a7a' }
                }}
              >
                Sauvegarder
              </Button>
              <Button
                variant="outlined"
                startIcon={<DescriptionIcon fontSize="small" />}
                onClick={handleExport}
                size="small"
                sx={{
                  fontSize: 14,
                  px: 2,
                  py: 0.5,
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#388e3c', color: '#388e3c' }
                }}
              >
                Exporter
              </Button>
            </Box>
          </Box>
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
                {name} - {month}
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
        {/* Bouton plein écran en mode normal */}
        {!isFullscreen && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<FullscreenIcon fontSize="small" />}
              onClick={toggleFullscreen}
              size="small"
              sx={{
                fontSize: 14,
                px: 2,
                py: 0.5,
                borderColor: '#ccc',
                color: '#666',
                textTransform: 'none',
                '&:hover': { borderColor: '#894991', color: '#894991' }
              }}
            >
              Plein écran
            </Button>
          </Box>
        )}
        {activityTableProps.map((props, index) => (
          <ActivityTable key={SECTION_LABELS[index].key} {...props} />
        ))}
        {!isFullscreen && (
          <>
            <Box sx={{ 
              width: '100%', 
              maxWidth: 1700, 
              mx: 'auto', 
              mt: 4, 
              mb: 2, 
              display: 'flex', 
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 2
            }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: '#f8f9fa',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e9ecef',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                minWidth: 'fit-content'
              }}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '60px'
                }}>
                  <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: '#6c757d', 
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Facturés
                  </Typography>
                  <Typography sx={{ 
                    fontSize: '1.5rem', 
                    color: '#894991', 
                    fontWeight: 700,
                    lineHeight: 1
                  }}>
                    {totalDays.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6c757d',
                  fontSize: '1.2rem',
                  fontWeight: 300
                }}>
                  /
                </Box>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '60px'
                }}>
                  <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: '#6c757d', 
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Jours Ouvrés
                  </Typography>
                  <Typography sx={{ 
                    fontSize: '1.5rem', 
                    color: '#495057', 
                    fontWeight: 700,
                    lineHeight: 1
                  }}>
                    {businessDaysInMonth}
                  </Typography>
                </Box>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginLeft: '12px',
                  paddingLeft: '12px',
                  borderLeft: '1px solid #dee2e6'
                }}>
                  <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: '#6c757d', 
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Taux
                  </Typography>
                  <Typography sx={{ 
                    fontSize: '1.2rem', 
                    color: totalDays / businessDaysInMonth >= 0.8 ? '#28a745' : totalDays / businessDaysInMonth >= 0.6 ? '#ffc107' : '#dc3545',
                    fontWeight: 700,
                    lineHeight: 1
                  }}>
                    {((totalDays / businessDaysInMonth) * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
            {saved && <Typography sx={{ color: "green", ml: 3, fontWeight: 500 }}>Compte rendu sauvegardé !</Typography>}
            {error && <Typography sx={{ color: "red", mt: 2, fontWeight: 500 }}>{error}</Typography>}
          </>
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
    </Box>
  );
} 