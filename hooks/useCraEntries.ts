"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getBusinessDaysCount } from '@/utils/businessDays';

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
  const [monthLocked, setMonthLocked] = useState<boolean>(false);

  const currentSignature = useMemo(() => {
    // Normalize values to avoid NaN/undefined toggling the signature and causing sticky dirty states
    const norm = entries
      .map(e => ({ d: e.date, c: (e as any).categoryId, v: (Number.isNaN(e.value as any) ? 0 : (e.value || 0)), m: (e.comment || '') }))
      .sort((a,b) => (String(a.d) + String(a.c)).localeCompare(String(b.d) + String(b.c)))
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
  // Format as local YYYY-MM-DD (avoid UTC shift)
  const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
      // Trust backend kinds as defined by admins
      for (const c of (cats || [])) {
        const currentKind = (c as any).kind as string | null | undefined;
        map[c.id] = { kind: currentKind };
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

  // Fetch month lock state
  const fetchMonthLock = useCallback(async () => {
    try {
      const { data } = await client.models.MonthLock.list({ filter: { month: { eq: month } } });
      const lock = (data || [])[0] as any;
      setMonthLocked(Boolean(lock?.locked));
    } catch {
      setMonthLocked(false);
    }
  }, [month]);

  useEffect(() => { fetchCategories(); fetchSpecialDays(); fetchMonthLock(); }, [fetchCategories, fetchSpecialDays, fetchMonthLock]);
  useEffect(() => {
    const id = setInterval(() => { fetchCategories(); }, 60000); // refresh kinds every 60s (dynamic comment rules)
    return () => clearInterval(id);
  }, [fetchCategories]);

  const isAdmin = groups.includes('ADMINS');
  const effectiveOwnerSub = targetSub && targetSub !== ownerSubRef.current ? targetSub : ownerSubRef.current;
  const isOwner = craOwnerSub && effectiveOwnerSub ? craOwnerSub === effectiveOwnerSub : true; // compare against targeted owner
  // If viewing someone else's CRA and not admin, force read-only regardless of status
  const viewingOther = effectiveOwnerSub && ownerSubRef.current && effectiveOwnerSub !== ownerSubRef.current;
  // When admin explicitly enables edit mode, allow overriding status locks for persistence
  const allowOverride = isAdmin && !!editMode;
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
  // Global month lock: block edits for everyone (admins included) unless explicit override is later added
  if (monthLocked) return true;
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
            const targetOwner = targetSub && targetSub.length > 0 ? targetSub : ownerSubRef.current;
            const createRes = await client.models.Cra.create({ month, owner: targetOwner as any, status: 'draft' as any });
            if (createRes.data) {
              setCraId(createRes.data.id);
              setStatus('draft');
              setCraOwnerSub(targetOwner || ownerSubRef.current);
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

  // React to external broadcast when entries are updated (e.g., leave approval sync)
  useEffect(() => {
    const onEntries = () => { loadCra(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('cra:entries-updated', onEntries as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cra:entries-updated', onEntries as any);
      }
    };
  }, [loadCra]);

  const updateEntry = useCallback((partial: Partial<Schema['CraEntry']['type']> & { id?: string; date: string; categoryId: any; value: number; comment?: string }) => {
    if (readOnly && !isAdmin) return;
    // Double-lock: vérifier status courant + signature backend en différé (anti race)
  if ((status === 'validated' || status === 'closed') && !allowOverride) return;
    // Vérification asynchrone du statut le plus récent avant de confirmer modification locale
    (async () => {
      if (!craId) return;
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
        if (latestStatus && latestStatus !== status) {
          setStatus(latestStatus);
      if ((latestStatus === 'validated' || latestStatus === 'closed') && !allowOverride) return; // abort unless admin override
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
  }, [craId, status, readOnly, allowOverride]);

  // Persist helper (moved above autosave effect to avoid temporal dead zone)
  const persistEntries = useCallback(async () => {
  if (!craId) return;
  if (readOnly && !isAdmin) return;
    if ((status === 'validated' || status === 'closed') && !allowOverride) return; // allow admin override
    // Re-fetch latest CRA status to enforce backend immutability semantics
    try {
      const latest = await client.models.Cra.get({ id: craId });
      const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
      if (latestStatus && latestStatus !== status) {
        setStatus(latestStatus);
        if ((latestStatus === 'validated' || latestStatus === 'closed') && !allowOverride) {
          // Abort only when not allowed to override
          return;
        }
      }
    } catch { /* silent */ }
  // Filtrer les entrées temporaires invalides (valeur NaN)
  const safeEntries = entries.filter(e => !(Number.isNaN(e.value)));
  const newOnes = safeEntries.filter(e => e.id.startsWith('temp-'));
  const existing = safeEntries.filter(e => !e.id.startsWith('temp-'));
  // Supprimer côté backend les entrées qui n'existent plus localement (par clé categoryId|date)
  // Utilise une reconciliation par clés désirées afin de supporter la suppression totale également.
  try {
    // Identify protected categories (Congé, Séminaire) by label so we don't delete their entries
    let protectedCatIds = new Set<string>();
    try {
      const { data: catsRaw } = await (client.models.Category.list as any)({});
      const cats = (catsRaw || []) as any[];
      cats.forEach(c => {
        const lbl = String(c.label || '').toLowerCase();
        if (lbl === 'congé' || lbl === 'conge' || lbl === 'séminaire' || lbl === 'seminaire') {
          protectedCatIds.add(String(c.id));
        }
      });
    } catch { /* ignore */ }
    const desiredKeys = new Set<string>();
    // Entrées locales actuelles
    safeEntries.forEach(e => {
      const cid = (e as any).categoryId as string; const d = e.date;
      if (cid && d) desiredKeys.add(`${cid}|${d}`);
    });
    // Récupérer les entrées persistées
    const { data: persisted } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
    const persistedList = (persisted || []) as Schema['CraEntry']['type'][];
    for (const p of persistedList) {
      const key = `${(p as any).categoryId as string}|${p.date}`;
      const cmt = String(((p as any)?.comment) || '');
      const srcType = String(((p as any)?.sourceType) || '');
      const isProtected = srcType === 'leave' || srcType === 'seminar' || cmt.includes('[CONGE]') || cmt.includes('[SEMINAIRE]') || protectedCatIds.has(String((p as any).categoryId));
      if (!desiredKeys.has(key) && !isProtected) {
        try { await client.models.CraEntry.delete({ id: p.id }); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
    for (const n of newOnes) {
      await (client.models.CraEntry.create as any)({ craId, date: n.date, categoryId: n.categoryId, value: n.value, comment: n.comment });
    }
    for (const ex of existing) {
      await client.models.CraEntry.update({ id: ex.id, value: ex.value, comment: ex.comment });
    }
  // Refresh local entries from backend and align saved signature
  try {
    const { data: fresh } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
    const freshList = (fresh || []) as Schema['CraEntry']['type'][];
    setEntries(freshList);
    try {
      type Sig = { d: string; c: string; v: number; m: string };
      const norm = freshList
        .map<Sig>((e) => ({ d: e.date, c: (e as any).categoryId as string, v: (Number.isNaN(e.value as any) ? 0 : (e.value as number || 0)), m: (e.comment as string) || '' }))
        .sort((a: Sig, b: Sig) => (a.d + a.c).localeCompare(b.d + b.c))
        .map((o: Sig) => `${o.d}:${o.c}:${o.v}:${o.m}`)
        .join('|');
      savedSignatureRef.current = norm;
    } catch { /* ignore */ }
  } catch { /* ignore refresh */ }
  setLastSavedAt(new Date());
  }, [entries, craId, status, readOnly, allowOverride]);

  // Persist a batch of pending values/comments directly (used by grid Save to avoid timing issues)
  const persistBatch = useCallback(async (
    pendingValues: Record<string, Record<string, number>>,
    pendingComments: Record<string, string>,
    pendingDeletes?: Record<string, string[]>
  ) => {
  if (!craId) return;
  if (readOnly && !isAdmin) return;
    if ((status === 'validated' || status === 'closed') && !allowOverride) return;
    setIsSaving(true);
    // Re-check latest status to avoid persisting on locked CRA
    try {
      const latest = await client.models.Cra.get({ id: craId });
      const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
      if (latestStatus && latestStatus !== status) {
        setStatus(latestStatus);
        if ((latestStatus === 'validated' || latestStatus === 'closed') && !allowOverride) return;
      }
    } catch { /* ignore */ }

    // Build quick lookup of existing entries
    const byKey = new Map<string, Schema['CraEntry']['type']>();
    entries.forEach(e => {
      const k = `${(e as any).categoryId}|${e.date}`;
      byKey.set(k, e);
    });

  // Conservative mode: do not delete persisted entries unless explicitly cleared by the user (pendingDeletes).
  // This avoids unintended loss of lines when local state misses some persisted cells.

    // Create or update values
    for (const [catId, dates] of Object.entries(pendingValues || {})) {
      for (const [date, value] of Object.entries(dates)) {
        if (Number.isNaN(value as any)) {
          // Coerce NaN to 0 to avoid dropping the entry silently
          (dates as any)[date] = 0 as any;
        }
        const key = `${catId}|${date}`;
        const existing = byKey.get(key);
        if (existing) {
          try { await client.models.CraEntry.update({ id: existing.id, value: (dates as any)[date] }); } catch {}
        } else {
          try { await (client.models.CraEntry.create as any)({ craId, date, categoryId: catId as any, value: (dates as any)[date] }); } catch {}
        }
      }
    }

    // Apply deletions for cleared cells (remove entries when the user leaves a day empty)
    if (pendingDeletes && Object.keys(pendingDeletes).length > 0) {
      // Identify protected categories to never delete automatically
      let protectedCatIds = new Set<string>();
      try {
        const { data: catsRaw } = await (client.models.Category.list as any)({});
        const cats = (catsRaw || []) as any[];
        cats.forEach(c => {
          const lbl = String(c.label || '').toLowerCase();
          if (lbl === 'congé' || lbl === 'conge' || lbl === 'séminaire' || lbl === 'seminaire') {
            protectedCatIds.add(String(c.id));
          }
        });
      } catch { /* ignore */ }
      for (const [catId, days] of Object.entries(pendingDeletes)) {
        if (protectedCatIds.has(String(catId))) continue;
        for (const date of days) {
          const key = `${catId}|${date}`;
          const existing = byKey.get(key);
          if (existing) {
            try { await client.models.CraEntry.delete({ id: existing.id }); } catch {}
          }
        }
      }
    }

    // Refresh entries then apply comment updates, await them, and refresh again so UI reflects new comments
    try {
      const { data: fresh } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
      const freshList = (fresh || []) as Schema['CraEntry']['type'][];
      setEntries(freshList);
      // Apply comments per category across existing entries and wait for all updates to complete
      const commentPromises: Promise<any>[] = [];
      for (const [catId, comment] of Object.entries(pendingComments || {})) {
        freshList
          .filter((e: Schema['CraEntry']['type']) => ((e as any).categoryId as string) === catId)
          .forEach((e: Schema['CraEntry']['type']) => {
            commentPromises.push(
              client.models.CraEntry.update({ id: e.id, value: e.value, comment })
                .catch(() => void 0)
            );
          });
      }
      if (commentPromises.length > 0) {
        try { await Promise.all(commentPromises); } catch { /* ignore individual failures */ }
      }
      // Re-fetch after comment updates so state and signature include updated comments
      const { data: fresh2 } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
      const finalList = (fresh2 || []) as Schema['CraEntry']['type'][];
      setEntries(finalList);
      setLastSavedAt(new Date());
      // Update saved signature to current snapshot (with comments) to reset dirty flag
      try {
        type Sig = { d: string; c: string; v: number; m: string };
        const norm = finalList
          .map<Sig>((e) => ({ d: e.date, c: (e as any).categoryId as string, v: (Number.isNaN(e.value as any) ? 0 : (e.value as number || 0)), m: (e.comment as string) || '' }))
          .sort((a: Sig, b: Sig) => (a.d + a.c).localeCompare(b.d + b.c))
          .map((o: Sig) => `${o.d}:${o.c}:${o.v}:${o.m}`)
          .join('|');
        savedSignatureRef.current = norm;
      } catch { /* ignore */ }
    } catch { /* ignore refresh */ }
    finally {
      setIsSaving(false);
    }
  }, [craId, entries, status, readOnly, allowOverride]);

  // Autosave désactivé : les données ne sont plus persistées automatiquement.

  const removeEntry = useCallback((id: string) => {
  if (readOnly && !isAdmin) return;
    if ((status === 'validated' || status === 'closed') && !allowOverride) return;
    (async () => {
      if (!craId) return;
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const latestStatus = (latest.data as any)?.status as CraStatus | undefined;
        if (latestStatus && latestStatus !== status) {
          setStatus(latestStatus);
          if ((latestStatus === 'validated' || latestStatus === 'closed') && !allowOverride) return; // abort only when not overriding
        }
      } catch { /* ignore */ }
      setEntries(prev => prev.filter(e => e.id !== id));
    })();
  }, [craId, status, readOnly, allowOverride]);

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
  // Use local date string to match entry dates and specialDays
  const dStr = `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, '0')}-${String(iter.getDate()).padStart(2, '0')}`;
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
    // Catégorie & commentaire (exigence au niveau de la catégorie, pas par jour)
    // Règle: si une catégorie (facturée/non facturée) a des heures (>0) sur le mois,
    // alors au moins un commentaire doit être présent pour cette catégorie.
    const perCategorySum: Record<string, number> = {};
    const perCategoryHasComment: Record<string, boolean> = {};
    entries.forEach(e => {
      const catId: any = (e as any).categoryId;
      const date = e.date;
      if (!catId) {
        errors.push(`Une ligne du ${date} a une valeur mais aucune catégorie n'est sélectionnée.`);
        return;
      }
      perCategorySum[catId] = (perCategorySum[catId] || 0) + (e.value || 0);
      if (e.comment && e.comment.trim().length > 0) perCategoryHasComment[catId] = true;
    });
    Object.entries(perCategorySum).forEach(([catId, sum]) => {
      const kind = categoriesMap[catId]?.kind;
      if ((kind === 'facturee' || kind === 'non_facturee') && sum > 0) {
        if (!perCategoryHasComment[catId]) {
          errors.push(`Commentaire requis (${kind === 'facturee' ? 'facturée' : 'non facturée'}) pour la catégorie.`);
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
          if ((ls === 'validated' || ls === 'closed') && !allowOverride) { return; }
        }
      } catch {}
      // Optionally persist entries (allow callers who already persisted via batch to skip here)
      const shouldPersist = options?.doPersist !== false;
      if (shouldPersist) {
        await persistEntries();
      }
      if (status === 'draft') {
        await client.models.Cra.update({ id: craId, status: 'saved', isSubmitted: false as any });
        setStatus('saved');
      }
      // Keep signature aligned only when we persisted here.
      // If doPersist === false, persistBatch already refreshed entries and updated the signature.
      if (shouldPersist) {
        savedSignatureRef.current = currentSignature;
      }
    } finally {
      setIsSaving(false);
    }
  }, [craId, status, persistEntries, currentSignature, isAdmin, isOwner, allowOverride]);

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

  // Reopen a validated CRA back to 'saved' to allow further edits.
  // Policy: allow the current user to reopen their own validated CRA even if the grid is read-only due to status.
  const reopenCra = useCallback(async () => {
    if (!craId) return false;
    // If readOnly is true, permit bypass only when not viewing another user's CRA and status is 'validated'.
    if (readOnly && !(status === 'validated' && !viewingOther)) return false;
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
  }, [craId, status, readOnly, viewingOther]);

  const resetAll = useCallback(async () => {
  if (!craId) return;
  if (readOnly && !isAdmin) return;
    setIsSaving(true);
    try {
      try {
        const latest = await client.models.Cra.get({ id: craId });
        const ls = (latest.data as any)?.status as CraStatus | undefined;
        if (ls && ls !== status) {
          setStatus(ls);
          if ((ls === 'validated' || ls === 'closed') && !allowOverride) { return; }
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
  }, [craId, entries, readOnly, allowOverride]);

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
