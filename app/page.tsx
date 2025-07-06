"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Box, TextField, Button, Typography, useTheme, IconButton } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import Navbar from "../components/Navbar";
import ActivityTable from "../components/ActivityTable";
import { exportExcel } from "../utils/exportExcel";

const SECTION_LABELS = [
  { key: "facturees", label: "Activités Facturées" },
  { key: "non_facturees", label: "Activités Non Facturées" },
  { key: "autres", label: "Autres" },
];

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

type SectionKey = "facturees" | "non_facturees" | "autres";

// Ajout des options de catégories par section
const CATEGORY_OPTIONS: { [key in SectionKey]: string[] } = {
  facturees: [
    "Prestation de formation",
    "Prestation régie / expertise"
  ],
  non_facturees: [
    "Ecole",
    "Auto-formation",
    "Formation interne",
    "Inter-contrat",
    "Journée séminaire, sortie",
    "Projet client",
    "Projet interne"
  ],
  autres: [
    "Absence autorisée",
    "Congé",
    "Maladie / Arrêt",
    "RTT"
  ]
};

export default function Home() {
  const today = new Date();
  const [name, setName] = useState("");
  const [localName, setLocalName] = useState("");
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const nameTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  type Category = { id: number; label: string };
  type CategoriesState = { [key in SectionKey]: Category[] };
  type DataState = { [key in SectionKey]: { [catId: number]: { [date: string]: string } } };

  const [categories, setCategories] = useState<CategoriesState>({
    facturees: [{ id: 1, label: "" }],
    non_facturees: [{ id: 1, label: "" }],
    autres: [{ id: 1, label: "" }],
  });
  const [data, setData] = useState<DataState>({
    facturees: {},
    non_facturees: {},
    autres: {},
  });
  const [saved, setSaved] = useState(false);
  const theme = useTheme();

  // Synchroniser le nom local avec le nom externe
  useEffect(() => {
    setLocalName(name);
  }, [name]);

  // Nettoyer le timeout lors du démontage
  useEffect(() => {
    return () => {
      if (nameTimeoutRef.current) {
        clearTimeout(nameTimeoutRef.current);
      }
    };
  }, []);

  // Générer les jours du mois sélectionné
  const [year, m] = month.split("-").map(Number);
  const days = useMemo(() => getDaysInMonth(year, m - 1), [year, m]);

  // Charger depuis localStorage
  useEffect(() => {
    const key = `cra_sections_${name}_${month}`;
    const savedData = localStorage.getItem(key);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setCategories(parsed.categories);
      setData(parsed.data);
      setSaved(true);
    } else {
      setCategories({
        facturees: [{ id: 1, label: "" }],
        non_facturees: [{ id: 1, label: "" }],
        autres: [{ id: 1, label: "" }],
      });
      setData({ facturees: {}, non_facturees: {}, autres: {} });
      setSaved(false);
    }
    // eslint-disable-next-line
  }, [name, month]);

  // Gestion des changements de saisie
  const handleCellChange = useCallback((section: SectionKey, catId: number, date: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [catId]: { ...prev[section][catId], [date]: value },
      },
    }));
    setSaved(false);
  }, []);

  // Gestion des changements de commentaire
  const handleCommentChange = useCallback((section: SectionKey, catId: number, value: string) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [catId]: {
          ...prev[section][catId],
          comment: value,
        },
      },
    }));
    setSaved(false);
  }, []);

  // Ajouter une catégorie
  const handleAddCategory = useCallback((section: SectionKey) => {
    setCategories((prev) => {
      const newId = prev[section].length > 0 ? Math.max(...prev[section].map(c => c.id)) + 1 : 1;
      return {
        ...prev,
        [section]: [...prev[section], { id: newId, label: "" }],
      };
    });
  }, []);

  // Supprimer une catégorie
  const handleDeleteCategory = useCallback((section: SectionKey, catId: number) => {
    setCategories((prev) => ({
      ...prev,
      [section]: prev[section].filter(c => c.id !== catId),
    }));
    setData((prev) => {
      const copy = { ...prev };
      delete copy[section][catId];
      return copy;
    });
    setSaved(false);
  }, []);

  // Changer le nom d'une catégorie
  const handleCategoryLabelChange = useCallback((section: SectionKey, catId: number, value: string) => {
    setCategories((prev) => ({
      ...prev,
      [section]: prev[section].map(c => c.id === catId ? { ...c, label: value } : c),
    }));
    setSaved(false);
  }, []);

  // Validation : une ligne avec données ne doit pas avoir une catégorie vide
  const hasInvalidCategory = useMemo(() => 
    Object.entries(categories).some(([section, cats]) =>
      cats.some(cat => {
        const row = data[section as SectionKey][cat.id] || {};
        const hasData = Object.entries(row).some(([k, v]) => k !== 'comment' && v) || row.comment;
        return hasData && !cat.label;
      })
    ), [categories, data]);
  
  const [error, setError] = useState("");

  // Sauvegarder dans localStorage
  const handleSave = useCallback(() => {
    if (!name) return alert("Merci de renseigner votre nom.");
    if (hasInvalidCategory) {
      setError("Une catégorie ne peut pas être vide si la ligne contient des données.");
      return;
    }
    setError("");
    localStorage.setItem(
      `cra_sections_${name}_${month}`,
      JSON.stringify({ categories, data })
    );
    setSaved(true);
  }, [name, hasInvalidCategory, categories, data, month]);

  // Optimiser les calculs de totaux avec une meilleure mémorisation
  const rowTotals = useMemo(() => {
    const totals: { [section in SectionKey]: { [catId: number]: number } } = {
      facturees: {},
      non_facturees: {},
      autres: {}
    };
    
    Object.entries(categories).forEach(([section, cats]) => {
      cats.forEach(cat => {
        const row = data[section as SectionKey][cat.id] || {};
        totals[section as SectionKey][cat.id] = days.reduce((sum, d) => 
          sum + (parseFloat(row[d.toISOString().slice(0, 10)]) || 0), 0
        );
      });
    });
    
    return totals;
  }, [categories, data, days]);

  // Calcul du total pour une ligne (catégorie) - optimisé
  const getRowTotal = useCallback((section: SectionKey, catId: number) => {
    return rowTotals[section][catId] || 0;
  }, [rowTotals]);

  // Calcul du total pour une section - optimisé
  const getSectionTotal = useCallback((section: SectionKey) => {
    return Object.values(rowTotals[section]).reduce((sum, total) => sum + total, 0);
  }, [rowTotals]);

  // Calcul du total de jours facturés (hors week-ends) - optimisé
  const getTotalWorkedDays = useCallback(() => {
    return Object.values(rowTotals.facturees).reduce((sum, total) => sum + total, 0);
  }, [rowTotals.facturees]);

  // Calcul du nombre de jours ouvrés dans le mois
  const getBusinessDaysInMonth = useCallback(() => {
    return days.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
  }, [days]);

  // Synchronisation du scroll horizontal des tableaux
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

  const totalDays = useMemo(() => getTotalWorkedDays(), [getTotalWorkedDays]);
  const businessDaysInMonth = useMemo(() => getBusinessDaysInMonth(), [getBusinessDaysInMonth]);

  // Contrôle de zoom global
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

  // Memoize les handlers pour les sections - optimisé
  const createSectionHandlers = useCallback((sectionKey: SectionKey) => ({
    onCategoryChange: (catId: number, value: string) => handleCategoryLabelChange(sectionKey, catId, value),
    onCellChange: (catId: number, date: string, value: string) => handleCellChange(sectionKey, catId, date, value),
    onAddCategory: () => handleAddCategory(sectionKey),
    onDeleteCategory: (catId: number) => handleDeleteCategory(sectionKey, catId),
    onCommentChange: (catId: number, value: string) => handleCommentChange(sectionKey, catId, value),
    getRowTotal: (catId: number) => getRowTotal(sectionKey, catId),
    getSectionTotal: () => getSectionTotal(sectionKey),
  }), [handleCategoryLabelChange, handleCellChange, handleAddCategory, handleDeleteCategory, handleCommentChange, getRowTotal, getSectionTotal]);

  // Memoize les props pour ActivityTable - optimisé
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
          if (el) {
            el.style.zoom = globalZoom.toString();
          }
        },
        onTableScroll: handleSyncScroll(sectionKey),
        ...handlers
      };
    }), [SECTION_LABELS, days, categories, data, createSectionHandlers, handleSyncScroll, globalZoom]);

  const handleExport = useCallback(() => {
    if (hasInvalidCategory) {
      setError("Une catégorie ne peut pas être vide si la ligne contient des données.");
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
  }, [hasInvalidCategory, name, month, days, categories, data]);

  // Optimiser les handlers des champs de texte avec debounce
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalName(newValue);
    
    // Annuler le timeout précédent
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
    }
    
    // Déclencher la mise à jour externe après 200ms d'inactivité
    nameTimeoutRef.current = setTimeout(() => {
      setName(newValue);
    }, 200);
  }, []);

  const handleMonthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(e.target.value);
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
      {!isFullscreen && <Navbar />}
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
              <TextField
                label="Nom / Prénom"
                value={localName}
                onChange={handleNameChange}
                sx={{ minWidth: 200 }}
                placeholder="Votre nom"
                size="small"
              />
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
                variant="contained"
                startIcon={<SaveIcon fontSize="small" />}
                onClick={handleSave}
                size="small"
                sx={{
                  fontWeight: 500,
                  fontSize: 15,
                  px: 2.5,
                  py: 0.5,
                  borderRadius: 2,
                  minWidth: 0,
                  background: "#894991",
                  boxShadow: "none",
                  textTransform: 'none',
                  '&:hover': { background: '#a05fa7' }
                }}
              >
                Enregistrer
              </Button>
              <Button
                variant="outlined"
                startIcon={<DescriptionIcon fontSize="small" sx={{ color: '#21a366' }} />}
                onClick={handleExport}
                size="small"
                sx={{
                  fontWeight: 500,
                  fontSize: 15,
                  px: 2.5,
                  py: 0.5,
                  borderRadius: 2,
                  minWidth: 0,
                  color: "#894991",
                  borderColor: "#894991",
                  textTransform: 'none',
                  boxShadow: "none",
                  '&:hover': { borderColor: '#a05fa7', color: '#a05fa7' }
                }}
                disabled={hasInvalidCategory}
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
            <Box sx={{ width: '100%', maxWidth: 1700, mx: 'auto', mt: 4, mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Typography sx={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>
                Total jours facturés : {totalDays.toFixed(2)} / {businessDaysInMonth} jours ouvrés
              </Typography>
            </Box>
            {saved && <Typography sx={{ color: "green", ml: 3, fontWeight: 500 }}>Compte rendu sauvegardé !</Typography>}
            {error && <Typography sx={{ color: "red", mt: 2, fontWeight: 500 }}>{error}</Typography>}
          </>
        )}
      </Box>
    </Box>
  );
}
