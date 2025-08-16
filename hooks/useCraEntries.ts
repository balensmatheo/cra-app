"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getBusinessDaysCount } from '@/utils/businessDays';
import { CATEGORY_OPTIONS } from '@/constants/ui';

const client = generateClient<Schema>();

export type CraStatus = 'draft' | 'saved' | 'validated' | 'closed';

interface UseCraEntriesResult {
  craId: string | null;
  status: CraStatus;
  setStatusLocal: (s: CraStatus) => void;
  entries: Schema['CraEntry']['type'][];
  specialDays: Schema['SpecialDay']['type'][]; // expose for UI summaries (congés, etc.)
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveDraft: (options?: { doPersist?: boolean }) => Promise<void>;
  validateCra: () => Promise<boolean>; // returns success
  closeCra: () => Promise<boolean>;
  reopenCra: () => Promise<boolean>; // allow editing after validation
  updateEntry: (partial: Partial<Schema['CraEntry']['type']> & { id?: string; date: string; categoryId: any; value: number; comment?: string }) => void;
  removeEntry: (id: string) => void;
  computeValidation: () => { ok: boolean; errors: string[] };
  readOnly: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  businessDays: number;
  lastSavedAt: Date | null;
  resetAll: () => Promise<void>;
  isDirty: boolean;
  persistBatch: (
    pendingValues: Record<string, Record<string, number>>,
    pendingComments: Record<string, string>,
    pendingDeletes?: Record<string, string[]>
  ) => Promise<void>;
}

// Placeholder categories mapping check (kind for comment requirement) - will be fetched later
interface CategoryLike { id: string; kind?: string | null }

export function useCraEntries(month: string, targetSub?: string | null, editMode?: boolean): UseCraEntriesResult {
  const [craId, setCraId] = useState<string | null>(null);
  const [status, setStatus] = useState<CraStatus>('draft');
  const [entries, setEntries] = useState<Schema['CraEntry']['type'][]>([]);
  const [craOwnerSub, setCraOwnerSub] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerSubRef = useRef<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, { kind?: string | null }>>({});
  const [specialDays, setSpecialDays] = useState<Schema['SpecialDay']['type'][]>([]);
  const [ownerReady, setOwnerReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const savedSignatureRef = useRef<string>("");

  const currentSignature = useMemo(() => {
    const norm = entries
      .map(e => ({ d: e.date, c: (e as any).categoryId, v: e.value, m: e.comment || '' }))
      .sort((a,b) => (a.d + a.c).localeCompare(b.d + b.c))
      .map(o => `${o.d}:${o.c}:${o.v}:${o.m}`)
      .join('|');
    return norm;
  }, [entries]);

  const isDirty = useMemo(() => currentSignature !== savedSignatureRef.current && status !== 'validated' && status !== 'closed', [currentSignature, status]);

  // Parse month
  const [year, monthNum] = month.split('-').map(Number); // monthNum = 08 etc
  const rawBusinessDays = useMemo(() => getBusinessDaysCount(year, monthNum - 1), [year, monthNum]);
  const businessDays = useMemo(() => {
    if (!specialDays.length) return rawBusinessDays;
    // Remove days that are ferie or conge_obligatoire (global scope or user-specific)
    const removeSet = new Set<string>();
    specialDays.forEach(sd => {
      if (sd.type === 'ferie' || sd.type === 'conge_obligatoire') {
        removeSet.add(sd.date);
      }
    });
    // Count weekdays minus removed
    let count = 0;
    const date = new Date(year, monthNum - 1, 1);
    while (date.getMonth() === monthNum - 1) {
      const day = date.getDay();
      const dStr = date.toISOString().slice(0,10);
      if (day !== 0 && day !== 6 && !removeSet.has(dStr)) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  }, [rawBusinessDays, specialDays, year, monthNum]);

  // Fetch user info
  useEffect(() => {
    fetchAuthSession().then(s => {
      const payload: any = s.tokens?.idToken?.payload || {};
      ownerSubRef.current = payload.sub || null;
      const cognitoGroups: string[] = payload['cognito:groups'] || [];
      setGroups(cognitoGroups);
  setOwnerReady(true);
    }).catch(() => void 0);
  }, []);

  // Categories & special days fetching (refactored for reuse + periodic refresh)
  const fetchCategories = useCallback(async () => {
    try {
      const { data: cats } = await client.models.Category.list({});
      const map: Record<string, { kind?: string | null }> = {};

      // Determine expected kind by label using frontend options
      const expectedKindByLabel: Record<string, 'facturee' | 'non_facturee' | 'autre'> = {} as any;
      (CATEGORY_OPTIONS.facturees || []).forEach(l => { expectedKindByLabel[l] = 'facturee'; });
      (CATEGORY_OPTIONS.non_facturees || []).forEach(l => { expectedKindByLabel[l] = 'non_facturee'; });
      (CATEGORY_OPTIONS.autres || []).forEach(l => { expectedKindByLabel[l] = 'autre'; });

      // Normalize backend kinds when labels are known (e.g., Congé => 'autre')
      for (const c of (cats || [])) {
        const label = (c as any).label as string;
        const currentKind = (c as any).kind as string | null | undefined;
        const expected = expectedKindByLabel[label];
        if (expected && currentKind !== expected) {
          try { await client.models.Category.update({ id: c.id, kind: expected as any }); } catch {}
          map[c.id] = { kind: expected };
        } else {
          map[c.id] = { kind: currentKind };
        }
      }
      setCategoriesMap(map);
    } catch {}
  }, []);

  const fetchSpecialDays = useCallback(async () => {
    try {
      const monthPrefix = month + '-';
      const { data: sds } = await client.models.SpecialDay.list({ filter: { date: { beginsWith: monthPrefix } } });
      setSpecialDays(sds || []);
    } catch {}
  }, [month]);

  useEffect(() => { fetchCategories(); fetchSpecialDays(); }, [fetchCategories, fetchSpecialDays]);
  // Écoute des événements broadcast pour rafraîchissement immédiat sans attendre l'intervalle
  useEffect(() => {
    const onCat = () => { fetchCategories(); };
    const onSD = () => { fetchSpecialDays(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('cra:categories-updated', onCat as any);
      window.addEventListener('cra:special-days-updated', onSD as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cra:categories-updated', onCat as any);
        window.removeEventListener('cra:special-days-updated', onSD as any);
      }
    };
  }, [fetchCategories, fetchSpecialDays]);
  useEffect(() => {
    const id = setInterval(() => { fetchCategories(); }, 60000); // refresh kinds every 60s (dynamic comment rules)
    return () => clearInterval(id);
  }, [fetchCategories]);

  const isAdmin = groups.includes('ADMINS');
  const effectiveOwnerSub = targetSub && targetSub !== ownerSubRef.current ? targetSub : ownerSubRef.current;
  const isOwner = craOwnerSub && effectiveOwnerSub ? craOwnerSub === effectiveOwnerSub : true; // compare against targeted owner
  // If viewing someone else's CRA and not admin, force read-only regardless of status
  const viewingOther = effectiveOwnerSub && ownerSubRef.current && effectiveOwnerSub !== ownerSubRef.current;
  // New policy: default to read-only when viewing; admin must opt-in via editMode to modify others.
  // Owners can edit their own CRA (subject to status) without editMode.
  const readOnly = (() => {
    // If viewing someone else
    if (viewingOther) {
      // Only admins in editMode can edit; otherwise read-only
      if (!isAdmin) return true;
      // Admin but no edit intent => read-only
      if (!editMode) return true;
    }
    // Status locks always apply unless admin+editMode
    if (status === 'closed') return !(isAdmin && editMode);
    if (status === 'validated') return !(isAdmin && editMode);
    // For draft/saved: non-owner cannot edit unless admin+editMode
    if (!isOwner) return !(isAdmin && editMode);
    return false;
  })();

  const loadCra = useCallback(async () => {
  if (!ownerSubRef.current) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      // List CRA for the target owner if provided; otherwise current user
      const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
      const targetOwner = targetSub && targetSub.length > 0 ? targetSub : ownerSubRef.current;
      // With allow.owner(), listing by non-admin won't return others' CRA; admins can see all.
      const myCra = (cras || []).find(c => (c as any).owner === targetOwner);
      if (myCra) {
        setCraId(myCra.id);
        setStatus((myCra as any).status as CraStatus || 'draft');
        setCraOwnerSub((myCra as any).owner || targetOwner || null);
    // Type provisoire : le champ relationnel craId n'est pas encore dans le type généré avant codegen
    const { data: craEntries } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: myCra.id } } });
    const list1 = (craEntries || []) as Schema['CraEntry']['type'][];
    setEntries(list1);
    // Align saved signature to loaded snapshot so page reload doesn't mark as dirty
    try {
      type Sig = { d: string; c: string; v: number; m: string };
      const norm = list1
        .map<Sig>((e) => ({ d: e.date, c: (e as any).categoryId as string, v: e.value as number, m: (e.comment as string) || '' }))
        .sort((a: Sig, b: Sig) => (a.d + a.c).localeCompare(b.d + b.c))
        .map((o: Sig) => `${o.d}:${o.c}:${o.v}:${o.m}`)
        .join('|');
      savedSignatureRef.current = norm;
    } catch { /* ignore */ }
      } else {
        // Vérification supplémentaire: re-lister après légère attente pour éviter duplication en cas de latence éventuelle
        await new Promise(r => setTimeout(r, 150));
        try {
          const { data: cras2 } = await client.models.Cra.list({ filter: { month: { eq: month } } });
          const targetOwner2 = targetSub && targetSub.length > 0 ? targetSub : ownerSubRef.current;
          const again = (cras2 || []).find(c => (c as any).owner === targetOwner2);
          if (again) {
            setCraId(again.id);
            setStatus((again as any).status as CraStatus || 'draft');
            setCraOwnerSub((again as any).owner || targetOwner2 || null);
            const { data: craEntries2 } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: again.id } } });
            const list2 = (craEntries2 || []) as Schema['CraEntry']['type'][];
            setEntries(list2);
            try {
              type Sig = { d: string; c: string; v: number; m: string };
              const norm = list2
                .map<Sig>((e) => ({ d: e.date, c: (e as any).categoryId as string, v: e.value as number, m: (e.comment as string) || '' }))
                .sort((a: Sig, b: Sig) => (a.d + a.c).localeCompare(b.d + b.c))
                .map((o: Sig) => `${o.d}:${o.c}:${o.v}:${o.m}`)
                .join('|');
              savedSignatureRef.current = norm;
            } catch { /* ignore */ }
            return;
          }
        } catch { /* ignore */ }
        // Create draft CRA lazily only when targeting self OR admin viewing others
        try {
          const allowCreate = !targetSub || targetSub === ownerSubRef.current || (isAdmin && !!editMode);
          if (allowCreate) {
            const createRes = await client.models.Cra.create({ month });
            if (createRes.data) {
              setCraId(createRes.data.id);
              setStatus('draft');
              setCraOwnerSub(ownerSubRef.current);
              setEntries([]);
              savedSignatureRef.current = "";
            }
          }
        } catch { /* ignore create errors (race) */ }
      }
    } catch (e: any) {
      setError(e.message || 'Erreur chargement CRA');
    } finally {
      setIsLoading(false);
    }
  }, [month, targetSub, isAdmin]);

  useEffect(() => { if (ownerReady) loadCra(); }, [loadCra, ownerReady]);

  const updateEntry = useCallback((partial: Partial<Schema['CraEntry']['type']> & { id?: string; date: string; categoryId: any; value: number; comment?: string }) => {
    if (readOnly) return;
    // Double-lock: vérifier status courant + signature backend en différé (anti race)
    if (status === 'validated' || status === 'closed') return;
    // Vérification asynchrone du statut le plus récent avant de confirmer modification locale
    (async () => {
      if (!craId) return;
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
        if (latestStatus && latestStatus !== status) {
          setStatus(latestStatus);
          if (latestStatus === 'validated' || latestStatus === 'closed') return; // abort
        }
      } catch { /* ignore */ }
      setEntries(prev => {
        if (partial.id) {
          return prev.map(e => e.id === partial.id ? { ...e, ...partial } : e);
        }
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        return [...prev, { id: tempId, craId: craId || '', date: partial.date, categoryId: partial.categoryId, value: partial.value, comment: partial.comment } as any];
      });
    })();
  }, [craId, status, readOnly]);

  // Persist helper (moved above autosave effect to avoid temporal dead zone)
  const persistEntries = useCallback(async () => {
  if (!craId) return;
  if (readOnly) return;
    if (status === 'validated' || status === 'closed') return; // guard
    // Re-fetch latest CRA status to enforce backend immutability semantics
    try {
      const latest = await client.models.Cra.get({ id: craId });
      const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
      if (latestStatus && latestStatus !== status) {
        setStatus(latestStatus);
        if (latestStatus === 'validated' || latestStatus === 'closed') {
          // Abort persistence if backend already locked it
          return;
        }
      }
    } catch { /* silent */ }
  // Filtrer les entrées temporaires invalides (valeur NaN)
  const safeEntries = entries.filter(e => !(Number.isNaN(e.value)));
  const newOnes = safeEntries.filter(e => e.id.startsWith('temp-'));
  const existing = safeEntries.filter(e => !e.id.startsWith('temp-'));
  // Supprimer côté backend les entrées qui n'existent plus localement
  // Sécurité: n'effectuer ces suppressions que si l'on a effectivement des entrées locales existantes à conserver.
  if (existing.length > 0) {
    try {
      const { data: persisted } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
      const persistedList = (persisted || []) as Schema['CraEntry']['type'][];
      const keepIds = new Set(existing.map(e => e.id));
      for (const p of persistedList) {
        if (!keepIds.has(p.id)) {
          try { await client.models.CraEntry.delete({ id: p.id }); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
    for (const n of newOnes) {
      await (client.models.CraEntry.create as any)({ craId, date: n.date, categoryId: n.categoryId, value: n.value, comment: n.comment });
    }
    for (const ex of existing) {
      await client.models.CraEntry.update({ id: ex.id, value: ex.value, comment: ex.comment });
    }
  setLastSavedAt(new Date());
  }, [entries, craId, status, readOnly]);

  // Persist a batch of pending values/comments directly (used by grid Save to avoid timing issues)
  const persistBatch = useCallback(async (
    pendingValues: Record<string, Record<string, number>>,
    pendingComments: Record<string, string>,
    pendingDeletes?: Record<string, string[]>
  ) => {
  if (!craId) return;
  if (readOnly) return;
    if (status === 'validated' || status === 'closed') return;
    setIsSaving(true);
    // Re-check latest status to avoid persisting on locked CRA
    try {
      const latest = await client.models.Cra.get({ id: craId });
      const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
      if (latestStatus && latestStatus !== status) {
        setStatus(latestStatus);
        if (latestStatus === 'validated' || latestStatus === 'closed') return;
      }
    } catch { /* ignore */ }

    // Build quick lookup of existing entries
    const byKey = new Map<string, Schema['CraEntry']['type']>();
    entries.forEach(e => {
      const k = `${(e as any).categoryId}|${e.date}`;
      byKey.set(k, e);
    });

    // Create or update values
    for (const [catId, dates] of Object.entries(pendingValues || {})) {
      for (const [date, value] of Object.entries(dates)) {
        if (Number.isNaN(value as any)) continue;
        const key = `${catId}|${date}`;
        const existing = byKey.get(key);
        if (existing) {
          try { await client.models.CraEntry.update({ id: existing.id, value }); } catch {}
        } else {
          try { await (client.models.CraEntry.create as any)({ craId, date, categoryId: catId as any, value }); } catch {}
        }
      }
    }

    // Apply deletions for cleared cells (remove entries when the user leaves a day empty)
    if (pendingDeletes && Object.keys(pendingDeletes).length > 0) {
      for (const [catId, days] of Object.entries(pendingDeletes)) {
        for (const date of days) {
          const key = `${catId}|${date}`;
          const existing = byKey.get(key);
          if (existing) {
            try { await client.models.CraEntry.delete({ id: existing.id }); } catch {}
          }
        }
      }
    }

    // Refresh entries to ensure subsequent operations are consistent and remove entries not present anymore
    try {
  const { data: fresh } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
      const freshList = (fresh || []) as Schema['CraEntry']['type'][];
      setEntries(freshList);
      // Apply comments per category across existing entries
      for (const [catId, comment] of Object.entries(pendingComments || {})) {
        freshList
          .filter((e: Schema['CraEntry']['type']) => ((e as any).categoryId as string) === catId)
          .forEach(async (e: Schema['CraEntry']['type']) => {
            try { await client.models.CraEntry.update({ id: e.id, value: e.value, comment }); } catch {}
          });
      }
  setLastSavedAt(new Date());
      // Update saved signature to current fresh snapshot to reset dirty flag
      try {
        type Sig = { d: string; c: string; v: number; m: string };
        const norm = freshList
          .map<Sig>((e) => ({ d: e.date, c: (e as any).categoryId as string, v: e.value as number, m: (e.comment as string) || '' }))
          .sort((a: Sig, b: Sig) => (a.d + a.c).localeCompare(b.d + b.c))
          .map((o: Sig) => `${o.d}:${o.c}:${o.v}:${o.m}`)
          .join('|');
        savedSignatureRef.current = norm;
      } catch { /* ignore */ }
    } catch { /* ignore refresh */ }
    finally {
      setIsSaving(false);
    }
  }, [craId, entries, status, readOnly]);

  // Autosave désactivé : les données ne sont plus persistées automatiquement.

  const removeEntry = useCallback((id: string) => {
  if (readOnly) return;
    if (status === 'validated' || status === 'closed') return;
    (async () => {
      if (!craId) return;
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
        if (latestStatus && latestStatus !== status) {
          setStatus(latestStatus);
          if (latestStatus === 'validated' || latestStatus === 'closed') return; // abort
        }
      } catch { /* ignore */ }
      setEntries(prev => prev.filter(e => e.id !== id));
    })();
  }, [craId, status, readOnly]);

  // Validation rules
  const computeValidation = useCallback(() => {
    const errors: string[] = [];
    // Sommes par jour
    const perDay: Record<string, number> = {};
    entries.forEach(e => { perDay[e.date] = (perDay[e.date] || 0) + (e.value || 0); });
    Object.entries(perDay).forEach(([d, sum]) => {
      if (Math.abs(sum - 1) > 1e-6) {
        errors.push(`Le total des activités du ${d} est ${sum.toFixed(2)} (doit être = 1). Ajustez les valeurs de cette journée.`);
      }
    });
    // Couverture des jours ouvrés : identifier jours manquants
    const enteredDays = new Set(Object.keys(perDay));
    const missing: string[] = [];
    const iter = new Date(year, monthNum - 1, 1);
    while (iter.getMonth() === monthNum - 1) {
      const day = iter.getDay();
      if (day !== 0 && day !== 6) { // weekday
        const dStr = iter.toISOString().slice(0,10);
        // retirer jours spéciaux exclus déjà soustraits du businessDays (ferie / conge_obligatoire)
        const excluded = specialDays.some(sd => (sd.type === 'ferie' || sd.type === 'conge_obligatoire') && sd.date === dStr);
        if (!excluded && !enteredDays.has(dStr)) missing.push(dStr);
      }
      iter.setDate(iter.getDate() + 1);
    }
    if (missing.length > 0) {
      const preview = missing.slice(0,5).join(', ');
      errors.push(`Jour(s) ouvré(s) sans saisie: ${preview}${missing.length > 5 ? ` ... (+${missing.length - 5})` : ''}. Ajoutez une activité pour chaque jour ouvré.`);
    }
    // Catégorie & commentaire
    entries.forEach(e => {
      const catId: any = (e as any).categoryId;
      const date = e.date;
      if (!catId) {
        errors.push(`Une ligne du ${date} a une valeur mais aucune catégorie n'est sélectionnée.`);
      } else {
        const kind = categoriesMap[catId]?.kind;
        if ((kind === 'facturee' || kind === 'non_facturee') && e.value > 0) {
          if (!e.comment || !e.comment.trim()) {
            errors.push(`Commentaire requis (${kind === 'facturee' ? 'facturée' : 'non facturée'}) pour le ${date}.`);
          }
        }
      }
    });
    return { ok: errors.length === 0, errors };
  }, [entries, businessDays, categoriesMap, year, monthNum, specialDays]);


  const saveDraft = useCallback(async (options?: { doPersist?: boolean }) => {
    if (!craId) return;
    if (!isAdmin && !isOwner) return;
    if (!isAdmin && viewingOther) return;
    setIsSaving(true);
    try {
      // enforce latest status
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const ls = (latest.data as any)?.status as CraStatus | undefined;
        if (ls && ls !== status) {
          setStatus(ls);
          if (ls === 'validated' || ls === 'closed') { return; }
        }
      } catch {}
      // Optionally persist entries (allow callers who already persisted via batch to skip here)
      if (options?.doPersist !== false) {
        await persistEntries();
      }
      if (status === 'draft') {
        await client.models.Cra.update({ id: craId, status: 'saved', isSubmitted: false as any });
        setStatus('saved');
      }
      // Keep signature aligned; persistEntries or upstream batch may have set it already
      savedSignatureRef.current = currentSignature;
    } finally {
      setIsSaving(false);
    }
  }, [craId, status, persistEntries, currentSignature, isAdmin, isOwner]);

  const validateCra = useCallback(async () => {
    if (!craId) return false;
    if (readOnly) return false;
    const { ok } = computeValidation();
    if (!ok) return false;
    try {
      // re-check status
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const ls = (latest.data as any)?.status as CraStatus | undefined;
        if (ls && ls !== status) {
          setStatus(ls);
          if (ls === 'validated' || ls === 'closed') { return false; }
        }
      } catch {}
      await persistEntries();
      await client.models.Cra.update({ id: craId, status: 'validated', isSubmitted: true as any });
      setStatus('validated');
      savedSignatureRef.current = currentSignature;
      return true;
    } finally { /* submitting spinner handled at UI level */ }
  }, [craId, computeValidation, persistEntries, currentSignature, readOnly, status]);

  const closeCra = useCallback(async () => {
  if (!craId) return false;
  if (readOnly) return false;
    if (status !== 'validated') return false; // must be validated first
    setIsSaving(true);
    try {
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const ls = (latest.data as any)?.status as CraStatus | undefined;
        if (ls && ls !== status) {
          setStatus(ls);
          if (ls === 'closed') { return false; }
          if (ls !== 'validated' as CraStatus) { return false; }
        }
      } catch {}
      await client.models.Cra.update({ id: craId, status: 'closed' });
      setStatus('closed');
    savedSignatureRef.current = currentSignature;
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [craId, status, currentSignature, readOnly]);

  // Reopen a validated CRA back to 'saved' to allow further edits (owner or admin)
  const reopenCra = useCallback(async () => {
  if (!craId) return false;
  if (readOnly) return false;
    setIsSaving(true);
    try {
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const ls = (latest.data as any)?.status as CraStatus | undefined;
        if (ls && ls !== status) {
          setStatus(ls);
        }
        // Only allow reopening from validated; do not reopen if already closed
        if (ls === 'closed') { return false; }
        if (ls !== 'validated') { return false; }
      } catch {}
  await client.models.Cra.update({ id: craId, status: 'saved', isSubmitted: false as any });
      setStatus('saved');
      setLastSavedAt(new Date());
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [craId, status, readOnly]);

  const resetAll = useCallback(async () => {
  if (!craId) return;
  if (readOnly) return;
    setIsSaving(true);
    try {
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const ls = (latest.data as any)?.status as CraStatus | undefined;
        if (ls && ls !== status) {
          setStatus(ls);
          if (ls === 'validated' || ls === 'closed') { return; }
        }
      } catch {}
      // delete all existing entries (skip temp ones which are local only)
      const toDelete = entries.filter(e => !e.id.startsWith('temp-'));
      for (const ex of toDelete) {
        try { await client.models.CraEntry.delete({ id: ex.id }); } catch {}
      }
      setEntries([]);
  await client.models.Cra.update({ id: craId, status: 'draft', isSubmitted: false as any });
      setStatus('draft');
      setLastSavedAt(new Date());
  savedSignatureRef.current = ""; // empty set baseline
    } finally {
      setIsSaving(false);
    }
  }, [craId, entries, readOnly]);

  return {
    craId,
    status,
    setStatusLocal: setStatus,
    entries,
  specialDays,
    isLoading,
    isSaving,
    error,
    saveDraft,
    validateCra,
  closeCra,
  reopenCra,
    updateEntry,
    removeEntry,
    computeValidation,
    readOnly,
    isOwner,
    isAdmin,
    businessDays,
  lastSavedAt,
  resetAll,
  isDirty,
  persistBatch,
  };
}
