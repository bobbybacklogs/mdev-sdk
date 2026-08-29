/**
 * Normalize a models.dev date for comparison/sorting.
 *
 * Dates are either `YYYY-MM` or `YYYY-MM-DD`. A month-only date is treated as
 * the 1st of that month (`YYYY-MM-01`); anything else is returned unchanged.
 */
export declare function normalizeDate(value: string): string;
/** Compare two date strings (`YYYY-MM` or `YYYY-MM-DD`) in ascending order. */
export declare function compareDates(a: string, b: string): number;
/** Sort date strings (ascending by default). Returns a new array. */
export declare function sortDates(values: readonly string[], order?: "asc" | "desc"): string[];
//# sourceMappingURL=dates.d.ts.map