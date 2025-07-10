"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { useCRAState } from './useCRAState';
import { SectionKey } from '@/constants/categories';

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

export const useCRAData = (ownerId: string | null, selectedMonth: string) => {
  const { categories, data, loadState, updateCell: dispatchUpdateCell, ...craState } = useCRAState();
  const [craId, setCraId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const resetState = useCallback(() => {
    loadState(initialEmptyState);
  }, [loadState]);

  const fetchCRA = useCallback(async () => {
    if (!ownerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [year, monthNum] = selectedMonth.split("-").map(Number);
    try {
      const { data: exists } = await client.models.CRA.list({
        filter: {
          owner: { eq: ownerId },
          year: { eq: year },
          month: { eq: monthNum }
        }
      });
      if (exists && exists.length > 0) {
        const parsed = JSON.parse(exists[0].dailyEntries || "{}");
        loadState(parsed);
        setCraId(exists[0].id);
      } else {
        resetState();
        setCraId(null);
      }
    } catch (err) {
      resetState();
      setCraId(null);
      setError('Erreur lors du chargement du CRA');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, selectedMonth, loadState, resetState]);

  useEffect(() => {
    fetchCRA();
  }, [fetchCRA]);

  const handleSave = useCallback(async (hasInvalidCategory: boolean) => {
    if (!ownerId) return;
    if (hasInvalidCategory) {
      setSnackbar({
        open: true,
        message: "Une catégorie ne peut pas être vide si la ligne contient des données.",
        severity: 'error'
      });
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const [year, monthNum] = selectedMonth.split("-").map(Number);
      const dailyEntriesJSON = JSON.stringify({ categories, data });
      if (craId) {
        await client.models.CRA.update({
          id: craId,
          dailyEntries: dailyEntriesJSON
        }, { authMode: 'userPool' });
      } else {
        const result = await client.models.CRA.create({
          owner: ownerId,
          year,
          month: monthNum,
          dailyEntries: dailyEntriesJSON
        }, { authMode: 'userPool' });
        setCraId(result.data?.id || null);
      }
      setSnackbar({
        open: true,
        message: 'Compte rendu sauvegardé',
        severity: 'success'
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde du CRA');
      setSnackbar({
        open: true,
        message: err.message || 'Erreur lors de la sauvegarde du CRA',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  }, [ownerId, selectedMonth, categories, data, craId]);

  const updateCell = useCallback((section: SectionKey, catId: number, date: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    if (numericValue > 1) {
      setSnackbar({
        open: true,
        message: "La valeur ne peut pas être supérieure à 1.",
        severity: 'error'
      });
      return;
    }

    let dayTotal = 0;
    for (const s of Object.keys(data) as SectionKey[]) {
      for (const c of Object.keys(data[s])) {
        const catKey = parseInt(c, 10);
        const dayValue = parseFloat(data[s][catKey]?.[date] || '0');
        if (s === section && catKey === catId) {
          continue;
        }
        dayTotal += dayValue;
      }
    }

    if (dayTotal + numericValue > 1) {
      setSnackbar({
        open: true,
        message: "Le total pour une journée ne peut pas dépasser 1.",
        severity: 'error'
      });
      return;
    }

    dispatchUpdateCell(section, catId, date, value);
  }, [data, dispatchUpdateCell, setSnackbar]);


  return {
    categories,
    data,
    ...craState,
    updateCell,
    craId,
    isLoading,
    isSaving,
    error,
    setError,
    snackbar,
    setSnackbar,
    fetchCRA,
    handleSave,
    resetState
  };
};