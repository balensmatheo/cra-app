"use client";

import { useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import AppContent from '@/app/(authenticated)/AppContent';
import { useCRA } from '@/context/CRAContext';

// Page CRA dynamique : /cra/[YYYY-MM]?user=me|<userId>
export default function CraMonthPage() {
  const params = useParams<{ month: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setMonthString, setTargetUser, setEditMode } = useCRA();

  const monthParam = params?.month; // attendu 'YYYY-MM'
  const userParam = searchParams.get('user');
  const editParam = searchParams.get('edit');

  useEffect(() => {
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      // Si mois invalide, rediriger vers mois courant
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
      router.replace(`/cra/${ym}?user=me`);
      return;
    }
    setMonthString(monthParam);
    // Apply target user from query ("me" or a cognito sub)
    if (userParam && typeof userParam === 'string') {
      setTargetUser(userParam);
    } else {
      setTargetUser('me');
    }
    // Edit mode: only enabled when explicit edit=1 is present; otherwise false
    if (editParam === '1' || editParam === 'true') setEditMode(true); else setEditMode(false);
  }, [monthParam, userParam, editParam, setMonthString, setTargetUser, setEditMode, router]);

  return <AppContent />;
}
