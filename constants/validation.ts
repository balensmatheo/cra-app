
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
  if (value === "") return true;
  const num = Number(value);
  if (isNaN(num)) return false;
  if (num < 0 || num > 1) return false;
  // autoriser quarts d'heure (0.25) – ajuster ici si autre granularité
  const quarter = Math.round(num * 100) / 100;
  return Math.abs((quarter * 100) % 25) < 1e-6; // multiples de 0.25
};

export const isDuplicateCategory = (categories: Array<{ id: number; label: string }>, newLabel: string, excludeId?: number): boolean => {
  return categories.some(cat => cat.label === newLabel && cat.id !== excludeId);
}; 