// Utility to compute business days in a month (basic: exclude weekends)
// Future enhancement: integrate SpecialDay (ferie, conge_obligatoire) filtering.
export function getBusinessDaysCount(year: number, monthIndexZeroBased: number): number {
  let count = 0;
  const date = new Date(year, monthIndexZeroBased, 1);
  while (date.getMonth() === monthIndexZeroBased) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    date.setDate(date.getDate() + 1);
  }
  return count;
}
