"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { useCraEntries } from './useCraEntries';
import { type SectionKey } from '@/constants/categories';

const client = generateClient<Schema>();

type Row = {
  id: number; // local numeric id for UI
  categoryId?: string; // backend Category id
  label: string; // category label (from select options)
  section: SectionKey;
  comment?: string;
};

interface UseCraGridResult {
  categories: Record<SectionKey, { id: number; label: string }[]>;
  data: Record<SectionKey, { [rowId: number]: Record<string, string | undefined> & { comment?: string } }>;
  categoryOptions: Record<SectionKey, string[]>;
  addCategory: (section: SectionKey) => void;
  deleteCategory: (section: SectionKey, rowId: number) => void;
  updateCategory: (section: SectionKey, rowId: number, label: string) => Promise<void>;
  updateCell: (section: SectionKey, rowId: number, date: string, value: string) => void;
  updateComment: (section: SectionKey, rowId: number, comment: string) => void;
  status: ReturnType<typeof useCraEntries>['status'];
  readOnly: boolean;
  saveDraft: () => Promise<void>;
  validateCra: () => Promise<boolean>;
  closeCra: () => Promise<boolean>;
  reopenCra: () => Promise<boolean>;
  computeValidation: ReturnType<typeof useCraEntries>['computeValidation'];
  isLoading: boolean;
  lastSavedAt: Date | null;
  resetAll: () => Promise<void>;
  isDirty: boolean;
  // Pending indicators (non persisté tant que saveDraft non appelé)
  pendingMatrix: Record<SectionKey, Record<number, Record<string, boolean>>>; // section -> rowId -> date(YYYY-MM-DD)-> pending?
  pendingComments: Record<SectionKey, Record<number, boolean>>; // section -> rowId -> comment pending
  isAdmin: boolean;
  isSaving: boolean;
}

const SECTION_KIND: Record<SectionKey, any> = {
  facturees: 'facturee',
  non_facturees: 'non_facturee',
  autres: 'autre',
};

export function useCraGrid(month: string, targetSub?: string | null, editMode?: boolean): UseCraGridResult {
  const cra = useCraEntries(month, targetSub, editMode);
  const { entries, updateEntry, removeEntry, status, readOnly, saveDraft: baseSaveDraft, validateCra, closeCra, reopenCra, computeValidation, isLoading: entriesLoading, lastSavedAt, resetAll, isDirty, persistBatch } = cra;
  const { isSaving } = cra as any;

  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  // Keep maps by label and by id to resolve categories reliably
  const [categoryByLabel, setCategoryByLabel] = useState<Record<string, Schema['Category']['type']>>({});
  const [categoryById, setCategoryById] = useState<Record<string, Schema['Category']['type']>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const nextRowIdRef = useRef(1);
  // Draft values for rows without category yet selected (rowId -> { date: value })
  const [draftValues, setDraftValues] = useState<Record<number, Record<string,string>>>({});
  const [draftComments, setDraftComments] = useState<Record<number,string>>({});
  // Valeurs en attente pour les catégories déjà créées (clé = categoryId)
  const [pendingValues, setPendingValues] = useState<Record<string, Record<string, number>>>({});
  const [pendingComments, setPendingComments] = useState<Record<string,string>>({});
  // Track deletions when a user clears a cell (empty string)
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, string[]>>({});

  // Signature supprimée pour éviter les reconstructions excessives des lignes lors de chaque frappe.

  // Centralized loader to (re)fetch categories
  const loadCategories = useCallback(async () => {
    try {
      const { data: existing } = await client.models.Category.list({});
      const byLabel: Record<string, Schema['Category']['type']> = {};
      const byId: Record<string, Schema['Category']['type']> = {};
      (existing || []).forEach(c => { byLabel[c.label] = c; byId[c.id] = c; });
      setCategoryByLabel(byLabel);
      setCategoryById(byId);
      setCategoriesLoaded(true);
    } catch {
      setCategoriesLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadCategories(); })();
    return () => { cancelled = true; };
  }, [loadCategories]);

  // Refresh categories when CRA entries are updated elsewhere (e.g., leave approval created a new category)
  useEffect(() => {
    const onEntries = () => { loadCategories(); };
    if (typeof window !== 'undefined') { window.addEventListener('cra:entries-updated', onEntries as any); }
    return () => { if (typeof window !== 'undefined') { window.removeEventListener('cra:entries-updated', onEntries as any); } };
  }, [loadCategories]);

  // Merge rows from existing saved entries continuously so data appears without re-selecting categories
  useEffect(() => {
    if (!categoriesLoaded || entriesLoading) return;
    const catIds = new Set<string>();
    entries.forEach(e => { const cid = (e as any).categoryId as string | undefined; if (cid) catIds.add(cid); });
    const needed: Row[] = [];
    catIds.forEach(categoryId => {
      // Prefer id-based lookup to avoid missing categories created after initial load
      const cat = categoryById[categoryId] || Object.values(categoryByLabel).find(c => c.id === categoryId);
      if (!cat) {
        // Fallback: if we don't have the category yet (race), still surface the row when it's a leave sync
        const hasLeaveSource = entries.some(e => (e as any).categoryId === categoryId && (String((e as any).sourceType||'') === 'leave' || (typeof (e as any).comment === 'string' && (e as any).comment.includes('[CONGE]'))));
        const label = hasLeaveSource ? 'Congé' : 'Catégorie';
        const section: SectionKey = 'autres';
        needed.push({ id: -1 as any, categoryId, label, section });
        return;
      }
      const kind = ((cat as any).kind as any);
      const section: SectionKey = (kind === 'facturee' ? 'facturees' : kind === 'non_facturee' ? 'non_facturees' : 'autres');
      needed.push({ id: -1 as any, categoryId, label: cat.label, section });
    });
    if (needed.length === 0) return;
    setRows(prev => {
      // Build a set of existing categoryIds to avoid duplicates
      const existing = new Set(prev.map(r => r.categoryId).filter((v): v is string => !!v));
      const toAdd = needed
        .filter(r => !existing.has(r.categoryId!))
        .map(r => ({ ...r, id: nextRowIdRef.current++ }));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, [categoriesLoaded, entriesLoading, entries, categoryById, categoryByLabel]);

  // Guarantee exactly one empty row per section if there are no saved rows; remove empty rows when saved rows exist
  useEffect(() => {
    if (!categoriesLoaded) return;
    setRows(prev => {
      let changed = false;
      let updated = [...prev];
      (['facturees','non_facturees','autres'] as SectionKey[]).forEach(section => {
        const sectionRows = updated.filter(r => r.section === section);
        const hasSaved = sectionRows.some(r => !!r.categoryId);
        if (hasSaved) {
          // remove all empty rows for this section
          const filtered = updated.filter(r => !(r.section === section && !r.categoryId && !r.label));
          if (filtered.length !== updated.length) { updated = filtered; changed = true; }
        } else {
          // ensure exactly one empty row
          const empties = sectionRows.filter(r => !r.categoryId && !r.label);
          if (empties.length === 0) {
            updated.push({ id: nextRowIdRef.current++, label: '', section });
            changed = true;
          } else if (empties.length > 1) {
            let kept = false;
            const filtered: Row[] = [];
            for (const r of updated) {
              if (r.section === section && !r.categoryId && !r.label) {
                if (!kept) { filtered.push(r); kept = true; } else { changed = true; }
              } else {
                filtered.push(r);
              }
            }
            updated = filtered;
          }
        }
      });
      return changed ? updated : prev;
    });
  }, [categoriesLoaded, entries]);

  // Remove auto-placeholder rows; only user-added rows plus rows from saved entries are shown.

  const ensureCategory = useCallback(async (
    label: string,
    section: SectionKey,
    opts?: { allowDuplicate?: boolean }
  ) => {
    if (!label) return undefined;
    // Par défaut, on réutilise la catégorie existante par label.
    // Mais si allowDuplicate=true (ex: 2e ligne avec même label), on force la création d'une nouvelle catégorie.
    if (!opts?.allowDuplicate && categoryByLabel[label]) return categoryByLabel[label];
    try {
      const { data } = await client.models.Category.create({ label, kind: SECTION_KIND[section] });
      if (data) {
        // Toujours indexer par id; pour le mapping par label, ne pas empêcher les doublons
        // (la dernière créée écrasera la référence simple, ce qui est acceptable pour les cas non-dupliqués).
        setCategoryById(prev => ({ ...prev, [data.id]: data }));
        if (!opts?.allowDuplicate) {
          setCategoryByLabel(prev => ({ ...prev, [label]: data }));
        }
      }
      return data || undefined;
    } catch (e) {
      // En cas de permission refusée pour create:
      //  - si allowDuplicate=false: réutiliser l'existante par label si dispo
      //  - sinon: signaler échec via undefined
      if (!opts?.allowDuplicate && categoryByLabel[label]) return categoryByLabel[label];
      return undefined;
    }
  }, [categoryByLabel]);

  const addCategory = useCallback((section: SectionKey) => {
    setRows(prev => [...prev, { id: nextRowIdRef.current++, label: '', section }]);
  }, []);

  const deleteCategory = useCallback((section: SectionKey, rowId: number) => {
    // Identify row and its category
    const row = rows.find(r => r.id === rowId);
    const categoryId = row?.categoryId;

    // Count rows in this section
    const sectionRows = rows.filter(r => r.section === section);
    const isOnlyRow = sectionRows.length <= 1;

    if (isOnlyRow) {
      // If it's the last row: clear its values and reset the row, but keep the line present.
      if (categoryId) {
        // Remove persisted entries locally so they will be deleted on save
        entries.filter(e => (e as any).categoryId === categoryId).forEach(e => removeEntry(e.id));
      }
      // Clear drafts/pending
      setDraftValues(prev => { const c = { ...prev }; delete c[rowId]; return c; });
      setDraftComments(prev => { const c = { ...prev }; delete c[rowId]; return c; });
      if (categoryId) {
        setPendingValues(prev => { const c = { ...prev }; delete c[categoryId]; return c; });
        setPendingComments(prev => { const c = { ...prev }; delete c[categoryId]; return c; });
      }
      // Reset the row to empty (no category, no label, no comment)
      setRows(prev => prev.map(r => r.id === rowId ? ({ id: r.id, label: '', section: r.section }) as Row : r));
      return;
    }

    // Otherwise: remove the row entirely
    setRows(prev => prev.filter(r => r.id !== rowId));

    // Remove any persisted entries for that category (local state) so persist step will delete on backend
    if (categoryId) {
      entries.filter(e => (e as any).categoryId === categoryId).forEach(e => removeEntry(e.id));
    }
    // Cleanup drafts and pending for this row/category
    setDraftValues(prev => { const c = { ...prev }; delete c[rowId]; return c; });
    setDraftComments(prev => { const c = { ...prev }; delete c[rowId]; return c; });
    if (categoryId) {
      setPendingValues(prev => { const c = { ...prev }; delete c[categoryId]; return c; });
      setPendingComments(prev => { const c = { ...prev }; delete c[categoryId]; return c; });
    }
  }, [rows, entries, removeEntry]);

  const updateCategory = useCallback(async (section: SectionKey, rowId: number, label: string) => {
    // Mettre à jour label immédiatement (optimiste)
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, label, section } : r));
  // Si une autre ligne possède déjà ce label (avec ou sans categoryId), on souhaite un doublon distinct
  const duplicateExists = rows.some(r => r.id !== rowId && r.label === label);
    const category = await ensureCategory(label, section, { allowDuplicate: duplicateExists });
    if (!category) return;
    // N'écraser que si categoryId absent (évite re-rendu brusque)
    setRows(prev => prev.map(r => r.id === rowId ? (r.categoryId ? r : { ...r, categoryId: category.id }) : r));
    // Migrate any draft values into real entries now that category exists
    setDraftValues(prev => {
      const dv = prev[rowId];
      if (dv) {
        setPendingValues(pv => {
          const clone = { ...pv };
            Object.entries(dv).forEach(([date,val]) => {
              const numeric = val ? parseFloat(val) : 0;
              if (!isNaN(numeric)) {
                clone[category.id!] = clone[category.id!] || {};
                clone[category.id!][date] = numeric;
              }
            });
          return clone;
        });
      }
      const clone = { ...prev }; delete clone[rowId]; return clone;
    });
    setDraftComments(prev => {
      const c = prev[rowId];
      if (c && c.trim()) {
        setPendingComments(pc => ({ ...pc, [category.id!]: c }));
      }
      const clone = { ...prev }; delete clone[rowId]; return clone;
    });
  }, [ensureCategory, rows]);

  const findEntry = useCallback((categoryId: string | undefined, date: string) => {
    if (!categoryId) return undefined;
  return entries.find(e => (e as any).categoryId === categoryId && e.date === date);
  }, [entries]);

  const updateCell = useCallback((section: SectionKey, rowId: number, date: string, value: string) => {
    if (readOnly) return;
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.categoryId) {
      // Ligne sans catégorie: nettoyer les brouillons correctement.
      // Si la valeur est vide, supprimer la clé de date; sinon, l'enregistrer.
      setDraftValues(prev => {
        const existing = prev[rowId] || {};
        const nextForRow = { ...existing } as Record<string, string>;
        if (value === '' || value == null) {
          // remove empty draft for that date
          if (nextForRow.hasOwnProperty(date)) delete nextForRow[date];
        } else {
          nextForRow[date] = value;
        }
        // If row draft becomes empty, drop the row entry entirely to avoid dirty flag
        const hasAny = Object.keys(nextForRow).length > 0;
        const clone = { ...prev } as Record<number, Record<string,string>>;
        if (hasAny) {
          clone[rowId] = nextForRow;
        } else {
          if (clone.hasOwnProperty(rowId)) delete clone[rowId];
        }
        return clone;
      });
      return;
    }
  if (value === '') {
      // Clearing a cell: schedule deletion and remove any pending value for this date
      setPendingValues(prev => {
        const clone = { ...prev };
        if (clone[row.categoryId!]) {
          const { [date]: _, ...rest } = clone[row.categoryId!] as any;
          clone[row.categoryId!] = rest;
        }
        return clone;
      });
      setPendingDeletes(prev => {
        const list = new Set([...(prev[row.categoryId!] || [])]);
        list.add(date);
        return { ...prev, [row.categoryId!]: Array.from(list) };
      });
      return;
    }
  // Normalize French decimal separator (comma) to dot before parsing
  const normalized = (value || '').replace(/\s/g, '').replace(',', '.');
  const numeric = normalized ? parseFloat(normalized) : 0;
    setPendingValues(prev => {
      const clone = { ...prev };
      clone[row.categoryId!] = { ...(clone[row.categoryId!] || {}), [date]: isNaN(numeric) ? 0 : numeric };
      return clone;
    });
    // If we had a pending deletion for this date, cancel it because we set a value again
    setPendingDeletes(prev => {
      const days = prev[row.categoryId!];
      if (!days) return prev;
      const filtered = days.filter(d => d !== date);
      if (filtered.length === days.length) return prev;
      return { ...prev, [row.categoryId!]: filtered };
    });
  }, [rows, readOnly]);

  const updateComment = useCallback((section: SectionKey, rowId: number, comment: string) => {
    if (readOnly) return;
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    if (!row.categoryId) {
      // For unsaved rows, avoid keeping empty comments as drafts
      setDraftComments(prev => {
        const clone = { ...prev } as Record<number, string>;
        if (comment && comment.trim().length > 0) {
          clone[rowId] = comment;
        } else {
          if (clone.hasOwnProperty(rowId)) delete clone[rowId];
        }
        return clone;
      });
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, comment: comment } : r));
      return;
    }
    setPendingComments(prev => ({ ...prev, [row.categoryId!]: comment }));
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, comment } : r));
  }, [rows, readOnly]);

  const grid = useMemo(() => {
    const categoriesBySection: UseCraGridResult['categories'] = { facturees: [], non_facturees: [], autres: [] } as any;
    const dataBySection: UseCraGridResult['data'] = { facturees: {}, non_facturees: {}, autres: {} } as any;
    const optionsBySection: UseCraGridResult['categoryOptions'] = { facturees: [], non_facturees: [], autres: [] } as any;
    const pendingMatrix: UseCraGridResult['pendingMatrix'] = { facturees: {}, non_facturees: {}, autres: {} } as any;
    const pendingCommentsBySection: UseCraGridResult['pendingComments'] = { facturees: {}, non_facturees: {}, autres: {} } as any;
    // Build options list from active backend categories per kind
    Object.values(categoryById).forEach((c) => {
      if ((c as any).active === false) return;
      const kind = (c as any).kind as 'facturee'|'non_facturee'|'autre'|undefined;
      const section: SectionKey = kind === 'facturee' ? 'facturees' : kind === 'non_facturee' ? 'non_facturees' : 'autres';
      if (!optionsBySection[section].includes(c.label)) optionsBySection[section].push(c.label);
    });
    // Preserve sorting by label for nicer UX
    (Object.keys(optionsBySection) as SectionKey[]).forEach(k => { optionsBySection[k] = optionsBySection[k].sort((a,b) => a.localeCompare(b)); });

    rows.forEach(r => {
      categoriesBySection[r.section].push({ id: r.id, label: r.label });
      const rowData: Record<string, string | undefined> & { comment?: string } = { comment: r.comment } as any;
      if (r.categoryId) {
        entries.filter(e => (e as any).categoryId === r.categoryId).forEach(e => {
          rowData[e.date] = (e.value !== undefined && e.value !== null) ? e.value.toString() : '';
          const c = (e as any).comment as string | undefined;
          if (c) rowData.comment = c;
        });
        // Superposer valeurs en attente non sauvegardées
  const pend = pendingValues[r.categoryId];
        if (pend) Object.entries(pend).forEach(([d,v]) => { rowData[d] = v.toString(); });
  // Cleared cells (pendingDeletes) should show as empty
  const dels = pendingDeletes[r.categoryId];
  if (dels) dels.forEach((d) => { rowData[d] = ''; });
        if (pendingComments[r.categoryId] && !pendingValues[r.categoryId]) {
          // commentaire pending (remplacera éventuellement)
          rowData.comment = pendingComments[r.categoryId];
        }
        // Marquage pending valeurs
        const pendVals = pendingValues[r.categoryId];
        if (pendVals) {
          Object.keys(pendVals).forEach(d => {
            pendingMatrix[r.section][r.id] = pendingMatrix[r.section][r.id] || {};
            pendingMatrix[r.section][r.id][d] = true;
          });
        }
        const delVals = pendingDeletes[r.categoryId];
        if (delVals) {
          delVals.forEach(d => {
            pendingMatrix[r.section][r.id] = pendingMatrix[r.section][r.id] || {};
            pendingMatrix[r.section][r.id][d] = true;
          });
        }
        if (pendingComments[r.categoryId]) {
          pendingCommentsBySection[r.section][r.id] = true;
        }
      } else {
        // Merge draft values for this unsaved row
        const dv = draftValues[r.id];
        if (dv) {
          Object.entries(dv).forEach(([d,v]) => { rowData[d] = v; });
          Object.keys(dv).forEach(d => {
            pendingMatrix[r.section][r.id] = pendingMatrix[r.section][r.id] || {};
            pendingMatrix[r.section][r.id][d] = true;
          });
        }
        if (draftComments[r.id] && !rowData.comment) rowData.comment = draftComments[r.id];
        if (draftComments[r.id]) pendingCommentsBySection[r.section][r.id] = true;
      }
      dataBySection[r.section][r.id] = rowData;
    });
    return { categories: categoriesBySection, data: dataBySection, categoryOptions: optionsBySection, pendingMatrix, pendingComments: pendingCommentsBySection };
  }, [rows, entries, draftValues, draftComments, pendingValues, pendingComments, categoryById]);

  // Flush des changements en attente vers les entrées (persistence)
  const flushPending = useCallback(async () => {
    // Valeurs
    Object.entries(pendingValues).forEach(([catId, dates]) => {
      Object.entries(dates).forEach(([date, val]) => {
        const existing = entries.find(e => (e as any).categoryId === catId && e.date === date);
        updateEntry({ id: existing?.id, date, categoryId: catId as any, value: val, comment: (existing as any)?.comment as any } as any);
      });
    });
    // Commentaires
    Object.entries(pendingComments).forEach(([catId, comment]) => {
      entries.filter(e => (e as any).categoryId === catId).forEach(e => {
        updateEntry({ id: e.id, date: e.date, categoryId: catId as any, value: e.value, comment } as any);
      });
    });
    // reset local pending (après propagation)
    setPendingValues({});
    setPendingComments({});
  }, [pendingValues, pendingComments, entries, updateEntry]);

  const saveDraft = useCallback(async () => {
    // 1) Promote draft values/comments for rows without category into real categories when label is provided
    //    If a row has values/comments but no label, block save to avoid data loss on reload.
    const nextPendingValues: Record<string, Record<string, number>> = { ...pendingValues };
    const nextPendingComments: Record<string, string> = { ...pendingComments };
    let unresolvedRows = 0;
    // Iterate rows to find unsaved rows with draft content
    for (const r of rows) {
      if (r.categoryId) continue;
      const dv = draftValues[r.id];
      const dc = draftComments[r.id];
      if (!dv && !(dc && dc.trim())) continue; // nothing to migrate
      if (!r.label || r.label.trim().length === 0) {
        unresolvedRows++;
        continue;
      }
      // Ensure category exists then migrate drafts into pending
      try {
  // Si une autre ligne a déjà ce label (avec ou sans categoryId), créer un doublon distinct
  const duplicateExists = rows.some(x => x.id !== r.id && x.label === r.label);
        const cat = await ensureCategory(r.label, r.section, { allowDuplicate: duplicateExists });
        if (cat && cat.id) {
          // Attach categoryId to the row locally so UI remains consistent
          setRows(prev => prev.map(x => x.id === r.id ? { ...x, categoryId: cat.id } as any : x));
          // Migrate values
      if (dv) {
            Object.entries(dv).forEach(([date, val]) => {
        // Normalize comma decimals
        const normalized = (val || '').replace(/\s/g, '').replace(',', '.');
        const numeric = normalized ? parseFloat(normalized) : 0;
              if (!Number.isNaN(numeric)) {
                nextPendingValues[cat.id!] = nextPendingValues[cat.id!] || {};
                nextPendingValues[cat.id!][date] = numeric;
              }
            });
          }
          // Migrate comment
          if (dc && dc.trim()) {
            nextPendingComments[cat.id!] = dc;
          }
          // Clear drafts for this row now that they are migrated
          setDraftValues(prev => { const c = { ...prev }; delete c[r.id]; return c; });
          setDraftComments(prev => { const c = { ...prev }; delete c[r.id]; return c; });
        } else {
          // Catégorie non disponible (ex: droit insuffisant). Marquer comme non résolu.
          unresolvedRows++;
        }
      } catch {
        // En cas d'erreur, ne pas dropper les brouillons ; marquer non résolu pour afficher une erreur à l'utilisateur.
        unresolvedRows++;
      }
    }
    if (unresolvedRows > 0) {
      throw new Error('Certaines lignes ont des valeurs sans catégorie. Sélectionnez une catégorie avant d\'enregistrer.');
    }

    // 2) Persist all pending (including migrated) in one batch
    await persistBatch(nextPendingValues, nextPendingComments, pendingDeletes);

    // 3) Reset local pending now that backend has newest state
    setPendingValues({});
    setPendingComments({});
    setPendingDeletes({});
    // Drop any remaining drafts (now migrated)
    setDraftValues({});
    setDraftComments({});
    // 4) Only update CRA status to 'saved' without re-persisting (avoid double-save/delete race)
    await baseSaveDraft({ doPersist: false });
    // 5) Force a quick refresh so saved signature and current entries are aligned immediately
    try { if (typeof window !== 'undefined') { window.dispatchEvent(new Event('cra:entries-updated')); } } catch { /* ignore */ }
    return;
  }, [rows, draftValues, draftComments, pendingValues, pendingComments, pendingDeletes, ensureCategory, persistBatch, baseSaveDraft]);

  return {
    categories: grid.categories,
    data: grid.data,
  categoryOptions: grid.categoryOptions,
    addCategory,
    deleteCategory,
    updateCategory,
    updateCell,
    updateComment,
    status,
    readOnly,
    saveDraft,
    validateCra,
  closeCra,
  reopenCra,
    computeValidation,
    isLoading: entriesLoading || !categoriesLoaded,
  lastSavedAt,
  resetAll,
  isDirty: isDirty || Object.keys(pendingValues).length>0 || Object.keys(pendingComments).length>0 || Object.keys(draftValues).length>0 || Object.keys(draftComments).length>0,
  pendingMatrix: grid.pendingMatrix,
  pendingComments: grid.pendingComments,
  isAdmin: cra.isAdmin,
  // surface saving state for header loading indicator (always present and typed)
  isSaving: !!isSaving,
  };
}
