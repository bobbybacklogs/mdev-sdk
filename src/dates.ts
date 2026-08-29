const MONTH_ONLY = /^\d{4}-\d{2}$/;

/**
 * Normalize a models.dev date for comparison/sorting.
 *
 * Dates are either `YYYY-MM` or `YYYY-MM-DD`. A month-only date is treated as
 * the 1st of that month (`YYYY-MM-01`); anything else is returned unchanged.
 */
export function normalizeDate(value: string): string {
  return MONTH_ONLY.test(value) ? `${value}-01` : value;
}

/** Compare two date strings (`YYYY-MM` or `YYYY-MM-DD`) in ascending order. */
export function compareDates(a: string, b: string): number {
  const na = normalizeDate(a);
  const nb = normalizeDate(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

/** Sort date strings (ascending by default). Returns a new array. */
export function sortDates(values: readonly string[], order: "asc" | "desc" = "asc"): string[] {
  return values.slice().sort((a, b) => {
    const cmp = compareDates(a, b);
    return order === "asc" ? cmp : -cmp;
  });
}
