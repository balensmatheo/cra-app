import { useReducer, useCallback } from 'react';
import { type SectionKey } from '../constants/categories';

export type Category = { id: number; label: string };
export type CategoriesState = { [K in SectionKey]: Category[] };
export type DataState = { [K in SectionKey]: { [catId: number]: { [date: string]: string } } };

type CRAState = {
  categories: CategoriesState;
  data: DataState;
};

type CRAAction = 
  | { type: 'UPDATE_CELL'; section: SectionKey; catId: number; date: string; value: string }
  | { type: 'UPDATE_COMMENT'; section: SectionKey; catId: number; value: string }
  | { type: 'UPDATE_CATEGORY'; section: SectionKey; catId: number; value: string }
  | { type: 'ADD_CATEGORY'; section: SectionKey }
  | { type: 'DELETE_CATEGORY'; section: SectionKey; catId: number }
  | { type: 'LOAD_STATE'; state: CRAState }
  | { type: 'RESET_STATE' };

const initialState: CRAState = {
  categories: {
    facturees: [{ id: 1, label: "" }],
    non_facturees: [{ id: 1, label: "" }],
    autres: [{ id: 1, label: "" }],
  },
  data: {
    facturees: {},
    non_facturees: {},
    autres: {},
  },
};

function craReducer(state: CRAState, action: CRAAction): CRAState {
  switch (action.type) {
    case 'UPDATE_CELL': {
      const { section, catId, date, value } = action;
      const currentSectionData = state.data[section] || {};
      const currentCatData = currentSectionData[catId] || {};
      
      // Vérifier si la valeur a réellement changé
      if (currentCatData[date] === value) {
        return state; // Pas de changement, retourner la référence précédente
      }
      
      return {
        ...state,
        data: {
          ...state.data,
          [section]: {
            ...currentSectionData,
            [catId]: { ...currentCatData, [date]: value },
          },
        },
      };
    }

    case 'UPDATE_COMMENT': {
      const { section, catId, value } = action;
      const currentSectionData = state.data[section] || {};
      const currentCatData = currentSectionData[catId] || {};
      
      // Vérifier si la valeur a réellement changé
      if (currentCatData.comment === value) {
        return state; // Pas de changement, retourner la référence précédente
      }
      
      return {
        ...state,
        data: {
          ...state.data,
          [section]: {
            ...currentSectionData,
            [catId]: { ...currentCatData, comment: value },
          },
        },
      };
    }

    case 'UPDATE_CATEGORY': {
      const { section, catId, value } = action;
      return {
        ...state,
        categories: {
          ...state.categories,
          [section]: state.categories[section].map((cat) =>
            cat.id === catId ? { ...cat, label: value } : cat
          ),
        },
      };
    }

    case 'ADD_CATEGORY': {
      const { section } = action;
      const newId = Math.max(...state.categories[section].map((cat) => cat.id), 0) + 1;
      return {
        ...state,
        categories: {
          ...state.categories,
          [section]: [...state.categories[section], { id: newId, label: "" }],
        },
      };
    }

    case 'DELETE_CATEGORY': {
      const { section, catId } = action;
      return {
        ...state,
        categories: {
          ...state.categories,
          [section]: state.categories[section].filter((cat) => cat.id !== catId),
        },
        data: {
          ...state.data,
          [section]: Object.fromEntries(
            Object.entries(state.data[section] || {}).filter(([id]) => Number(id) !== catId)
          ),
        },
      };
    }

    case 'LOAD_STATE': {
      return action.state;
    }

    case 'RESET_STATE': {
      return initialState;
    }

    default:
      return state;
  }
}

export function useCRAState() {
  const [state, dispatch] = useReducer(craReducer, initialState);

  const updateCell = useCallback((section: SectionKey, catId: number, date: string, value: string) => {
    dispatch({ type: 'UPDATE_CELL', section, catId, date, value });
  }, []);

  const updateComment = useCallback((section: SectionKey, catId: number, value: string) => {
    dispatch({ type: 'UPDATE_COMMENT', section, catId, value });
  }, []);

  const updateCategory = useCallback((section: SectionKey, catId: number, value: string) => {
    dispatch({ type: 'UPDATE_CATEGORY', section, catId, value });
  }, []);

  const addCategory = useCallback((section: SectionKey) => {
    dispatch({ type: 'ADD_CATEGORY', section });
  }, []);

  const deleteCategory = useCallback((section: SectionKey, catId: number) => {
    dispatch({ type: 'DELETE_CATEGORY', section, catId });
  }, []);

  const loadState = useCallback((newState: CRAState) => {
    dispatch({ type: 'LOAD_STATE', state: newState });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  return {
    state,
    categories: state.categories,
    data: state.data,
    updateCell,
    updateComment,
    updateCategory,
    addCategory,
    deleteCategory,
    loadState,
    resetState,
  };
} 