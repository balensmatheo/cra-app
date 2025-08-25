"use client";

import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';

const client = generateClient<Schema>();

interface CRAContextType {
  submittedMonths: number[]; // months with non-draft status
  monthStatusMap: Record<number, string>; // monthNumber (1-12) -> status
  monthLockedMap: Record<number, boolean>; // monthNumber (1-12) -> locked by admin (MonthLock)
  selectedMonth: string; // format YYYY-MM
  selectMonth: (month: number) => void; // legacy (same year)
  setMonthString: (ym: string) => void; // new: set any YYYY-MM directly
  currentYear: number;
  refreshMonthStatuses: () => void;
  updateMonthLockedLocal: (ym: string, locked: boolean) => void; // optimistic local update for current year
  updateMonthStatusLocal: (ym: string, status: string) => void; // optimistic local update for current year
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  // Cross-user viewing
  currentUserSub: string | null;
  targetUser: string | null; // 'me' or a Cognito sub
  setTargetUser: (u: string | null) => void;
  resolvedTargetSub: string | null; // actual sub to use (self when targetUser === 'me' or null)
  // Edit intent (admin must opt-in via pencil). Default false.
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const CRAContext = createContext<CRAContextType | undefined>(undefined);

export const CRAProvider = ({ children }: { children: ReactNode }) => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [submittedMonths, setSubmittedMonths] = useState<number[]>([]);
  const [monthStatusMap, setMonthStatusMap] = useState<Record<number,string>>({});
  const [monthLockedMap, setMonthLockedMap] = useState<Record<number, boolean>>({});
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentUserSub, setCurrentUserSub] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<string | null>('me');
  const [editMode, setEditMode] = useState<boolean>(false);
  const currentYear = today.getFullYear();
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Determine which user's CRA data we should display (self by default)
  const resolvedTargetSubLocal = targetUser && targetUser !== 'me' ? targetUser : currentUserSub;

  useEffect(() => {
  const getOwnerId = async () => {
      try {
        const session = await fetchAuthSession();
        const sub = session.tokens?.idToken?.payload.sub;
        if (sub) {
          setOwnerId(sub);
      setCurrentUserSub(sub);
        }
      } catch (error) {
        console.error("Error fetching user session:", error);
      }
    };
    getOwnerId();
  }, []);

  const fetchSubmittedCRAs = useCallback(async (year: number) => {
    // Ensure we know which user's CRAs to load (self by default)
    if (!resolvedTargetSubLocal) return;
    try {
      // Nouveau modèle Cra : champ month = 'YYYY-MM'; owner filtré automatiquement par allow.owner
      const prefix = `${year}-`;
      const { data: cras } = await client.models.Cra.list({
        filter: { month: { beginsWith: prefix }, owner: { eq: resolvedTargetSubLocal } as any }
      });
      // Fetch MonthLock for the year to surface locked months in the drawer
      const { data: locks } = await client.models.MonthLock.list({
        filter: { month: { beginsWith: prefix } }
      });
      const statusMap: Record<number,string> = {};
      const lockedMap: Record<number, boolean> = {};
      (cras || []).forEach(c => {
        if (!c.month) return;
        const parts = c.month.split('-');
        const n = parseInt(parts[1],10);
        if (!isNaN(n)) {
          const status = (c as any).status || 'draft';
          const isSubmitted = Boolean((c as any).isSubmitted);
          // Surface a distinct 'submitted' state when awaiting admin validation
          if (isSubmitted && status !== 'validated' && status !== 'closed') {
            statusMap[n] = 'submitted';
          } else {
            statusMap[n] = status;
          }
        }
      });
      (locks || []).forEach(l => {
        if (!l.month) return;
        const parts = l.month.split('-');
        const n = parseInt(parts[1],10);
        if (!isNaN(n)) {
          lockedMap[n] = Boolean((l as any).locked);
        }
      });
      // submittedMonths now = months with status != draft
      setMonthStatusMap(statusMap);
      setMonthLockedMap(lockedMap);
      setSubmittedMonths(Object.entries(statusMap).filter(([,s]) => s !== 'draft').map(([m]) => parseInt(m,10)));
    } catch (error) {
      console.error("Error fetching submitted CRAs (Cra model)", error);
    }
  }, [resolvedTargetSubLocal]);

  useEffect(() => {
    if (resolvedTargetSubLocal) {
      fetchSubmittedCRAs(currentYear);
    }
  }, [resolvedTargetSubLocal, currentYear, fetchSubmittedCRAs]);

  const selectMonth = (month: number) => {
    setSelectedMonth(`${currentYear}-${String(month + 1).padStart(2, "0")}`);
  };

  const setMonthString = (ym: string) => {
    if (/^\d{4}-\d{2}$/.test(ym)) {
      setSelectedMonth(ym);
    } else {
      console.warn('Mauvais format de mois (attendu YYYY-MM):', ym);
    }
  };

  const value = {
  submittedMonths,
  monthStatusMap,
  monthLockedMap,
    selectedMonth,
    selectMonth,
    setMonthString,
    currentYear,
  refreshMonthStatuses: () => fetchSubmittedCRAs(currentYear),
  updateMonthLockedLocal: (ym: string, locked: boolean) => {
    // ym format 'YYYY-MM'
    const [y, m] = ym.split('-');
    if (Number(y) !== currentYear) return; // drawer shows current year only
    const monthNum = parseInt(m, 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      setMonthLockedMap(prev => ({ ...prev, [monthNum]: locked }));
    }
  },
  updateMonthStatusLocal: (ym: string, status: string) => {
    const [y, m] = ym.split('-');
    if (Number(y) !== currentYear) return;
    const monthNum = parseInt(m, 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      setMonthStatusMap(prev => {
        const next = { ...prev, [monthNum]: status } as Record<number, string>;
        // Keep submittedMonths in sync (non-draft)
        const subs = Object.entries(next)
          .filter(([, s]) => s !== 'draft')
          .map(([mm]) => parseInt(mm, 10));
        setSubmittedMonths(subs);
        return next;
      });
    }
  },
  isFullscreen,
  setIsFullscreen,
  // Cross-user viewing
  currentUserSub,
  targetUser,
  setTargetUser,
  resolvedTargetSub: resolvedTargetSubLocal,
  editMode,
  setEditMode,
  };

  return <CRAContext.Provider value={value}>{children}</CRAContext.Provider>;
};

export const useCRA = () => {
  const context = useContext(CRAContext);
  if (context === undefined) {
    throw new Error('useCRA must be used within a CRAProvider');
  }
  return context;
};