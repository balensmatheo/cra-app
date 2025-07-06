import { ALLOWED_DAY_VALUES } from './ui';

export const VALIDATION_RULES = {
  MAX_HOURS_PER_DAY: 1,
  MIN_MONTH: "2020-01",
  MAX_MONTH: "2030-12",
} as const;

export const isFutureMonth = (month: string): boolean => {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return month > currentMonth;
};

export const isValidDayValue = (value: string): boolean => {
  return value === "" || ALLOWED_DAY_VALUES.includes(value);
};

export const isDuplicateCategory = (categories: Array<{ id: number; label: string }>, newLabel: string, excludeId?: number): boolean => {
  return categories.some(cat => cat.label === newLabel && cat.id !== excludeId);
}; 