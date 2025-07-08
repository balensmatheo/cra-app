import { useMemo, useCallback } from 'react';
import { SectionKey } from '../constants/categories';

export type Category = { id: number; label: string };
export type CategoriesState = { [key in SectionKey]: Category[] };
export type DataState = { [key in SectionKey]: { [catId: number]: { [date: string]: string } } };

export const useCRAEngine = (
  categories: CategoriesState,
  data: DataState,
  days: Date[]
) => {
  // Générer les jours du mois sélectionné
  const getDaysInMonth = useCallback((year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, []);

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

  // Vérifier si une catégorie a des données
  const hasCategoryData = useCallback((section: SectionKey, catId: number) => {
    const row = data[section][catId] || {};
    return Object.entries(row).some(([k, v]) => k !== 'comment' && v) || row.comment;
  }, [data]);

  // Vérifier si une section peut supprimer sa dernière ligne
  const canDeleteLastCategory = useCallback((section: SectionKey) => {
    const sectionCategories = categories[section];
    if (sectionCategories.length <= 1) {
      // Ne peut supprimer que si la ligne est vide
      return !hasCategoryData(section, sectionCategories[0]?.id);
    }
    return true;
  }, [categories, hasCategoryData]);

  return {
    getDaysInMonth,
    getRowTotal,
    getSectionTotal,
    getTotalWorkedDays,
    getBusinessDaysInMonth,
    hasCategoryData,
    canDeleteLastCategory,
    rowTotals
  };
}; 