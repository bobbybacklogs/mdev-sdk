/** ANSI styles understood by {@link color}. */
export type Color = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "dim" | "bold" | "underline";
/**
 * Override color auto-detection. Pass `undefined` (or never call this) to
 * restore auto-detection based on the environment and stdout TTY state.
 */
export declare function setColorEnabled(enabled?: boolean): void;
/**
 * Whether ANSI colors should be emitted:
 * - `FORCE_COLOR`/`CLICOLOR_FORCE` set (non-empty, not "0") → on
 * - `NO_COLOR` set or `TERM === "dumb"` → off
 * - otherwise on only when stdout is a TTY
 */
export declare function colorEnabled(): boolean;
/**
 * Wrap `text` in ANSI escape codes for the given styles. Returns `text`
 * unchanged when colors are disabled or when no valid styles are given.
 * Unknown styles (only possible from untyped JS callers) are skipped.
 */
export declare function color(text: string, ...styles: Color[]): string;
/** Remove ANSI SGR escape sequences from `s`. */
export declare function stripAnsi(s: string): string;
/** Visible length of `s`, ignoring ANSI escapes (no wide-char math). */
export declare function visibleLength(s: string): number;
/**
 * Cut `s` to `max` visible characters, appending `...` (ascii) or `…` when
 * truncated. Operates on plain text; callers apply color AFTER truncation.
 */
export declare function truncate(s: string, max: number, ascii?: boolean): string;
/**
 * Wrap `s` to `width` visible characters on word boundaries. Words longer than
 * `width` are hard-broken. Returns `[]` for empty input or `width <= 0`.
 */
export declare function wrapText(s: string, width: number): string[];
/** A table cell. `text` must be plain (uncolored); color is applied after truncation. */
export interface TableCell {
    text: string;
    color?: Color[];
}
/** A table column. Default align is `"left"`; default `max` is 32. */
export interface TableColumn {
    header: string;
    align?: "left" | "right";
    max?: number;
}
/**
 * Render a box-drawing table. Column widths are the max of header and cell
 * visible lengths, capped at `column.max` (never below the header length), and
 * shrunk (widest-first, never below header length) until the whole table fits
 * within `maxWidth`. Cells are truncated before color is applied so ANSI codes
 * are never split. One `\n` per line, no trailing blank line.
 */
export declare function renderTable(columns: TableColumn[], rows: TableCell[][], opts?: {
    maxWidth?: number;
    ascii?: boolean;
}): string;
/** Map a model status to a badge label and color. Absent/`"ga"` → GA. */
export declare function statusBadge(status?: string): {
    text: string;
    color: Color[] | undefined;
};
/** A table cell for a USD-per-1M cost. Missing/NaN renders gray; 0 is green. */
export declare function costCell(costInput: number | undefined, ascii?: boolean): TableCell;
//# sourceMappingURL=format.d.ts.map