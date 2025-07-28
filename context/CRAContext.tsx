"use client";

import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { fetchAuthSession } from 'aws-amplify/auth';

const client = generateClient<Schema>();

interface CRAContextType {
  submittedMonths: number[];
  selectedMonth: string;
  selectMonth: (month: number) => void;
  currentYear: number;
}

const CRAContext = createContext<CRAContextType | undefined>(undefined);

export const CRAProvider = ({ children }: { children: ReactNode }) => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [submittedMonths, setSubmittedMonths] = useState<number[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const currentYear = today.getFullYear();

  useEffect(() => {
    const getOwnerId = async () => {
      try {
        const session = await fetchAuthSession();
        const sub = session.tokens?.idToken?.payload.sub;
        if (sub) {
          setOwnerId(sub);
        }
      } catch (error) {
        console.error("Error fetching user session:", error);
      }
    };
    getOwnerId();
  }, []);

  const fetchSubmittedCRAs = useCallback(async (year: number) => {
    if (!ownerId) return;
    try {
      const { data: cras } = await client.models.CRA.list({
        filter: {
          owner: { eq: ownerId },
          year: { eq: year }
        }
      });
      const months = cras.map(cra => cra.month).filter((m): m is number => m !== null);
      setSubmittedMonths(months);
    } catch (error) {
      console.error("Error fetching submitted CRAs", error);
    }
  }, [ownerId]);

  useEffect(() => {
    if (ownerId) {
      fetchSubmittedCRAs(currentYear);
    }
  }, [ownerId, currentYear, fetchSubmittedCRAs]);

  const selectMonth = (month: number) => {
    setSelectedMonth(`${currentYear}-${String(month + 1).padStart(2, "0")}`);
  };

  const value = {
    submittedMonths,
    selectedMonth,
    selectMonth,
    currentYear
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