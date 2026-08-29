import { formatCostUSD } from "./pricing.js";
const ANSI_CODES = {
    black: "30",
    red: "31",
    green: "32",
    yellow: "33",
    blue: "34",
    magenta: "35",
    cyan: "36",
    white: "37",
    gray: "90",
    dim: "2",
    bold: "1",
    underline: "4",
};
/** Explicit color override; `undefined` means auto-detect. */
let colorOverride;
/**
 * Override color auto-detection. Pass `undefined` (or never call this) to
 * restore auto-detection based on the environment and stdout TTY state.
 */
export function setColorEnabled(enabled) {
    colorOverride = enabled;
}
/**
 * Whether ANSI colors should be emitted:
 * - `FORCE_COLOR`/`CLICOLOR_FORCE` set (non-empty, not "0") → on
 * - `NO_COLOR` set or `TERM === "dumb"` → off
 * - otherwise on only when stdout is a TTY
 */
export function colorEnabled() {
    if (colorOverride !== undefined)
        return colorOverride;
    const force = process.env.FORCE_COLOR ?? process.env.CLICOLOR_FORCE;
    if (force !== undefined && force !== "" && force !== "0")
        return true;
    if (process.env.NO_COLOR !== undefined || process.env.TERM === "dumb")
        return false;
    return process.stdout.isTTY === true;
}
/**
 * Wrap `text` in ANSI escape codes for the given styles. Returns `text`
 * unchanged when colors are disabled or when no valid styles are given.
 * Unknown styles (only possible from untyped JS callers) are skipped.
 */
export function color(text, ...styles) {
    if (!colorEnabled())
        return text;
    const codes = styles
        .map((style) => ANSI_CODES[style])
        .filter((code) => code !== undefined);
    if (codes.length === 0)
        return text;
    return `\x1b[${codes.join(";")}m${text}\x1b[0m`;
}
/** Remove ANSI SGR escape sequences from `s`. */
export function stripAnsi(s) {
    return s.replace(/\x1b\[[0-9;]*m/g, "");
}
/** Visible length of `s`, ignoring ANSI escapes (no wide-char math). */
export function visibleLength(s) {
    return stripAnsi(s).length;
}
/**
 * Cut `s` to `max` visible characters, appending `...` (ascii) or `…` when
 * truncated. Operates on plain text; callers apply color AFTER truncation.
 */
export function truncate(s, max, ascii = false) {
    if (max <= 0)
        return "";
    const suffix = ascii ? "..." : "…";
    if (visibleLength(s) <= max)
        return s;
    const budget = Math.max(0, max - visibleLength(suffix));
    const cut = s.slice(0, budget);
    return visibleLength(cut) + visibleLength(suffix) <= max ? cut + suffix : s.slice(0, max);
}
/**
 * Wrap `s` to `width` visible characters on word boundaries. Words longer than
 * `width` are hard-broken. Returns `[]` for empty input or `width <= 0`.
 */
export function wrapText(s, width) {
    if (width <= 0)
        return [];
    const words = s.split(/\s+/).filter((word) => word !== "");
    const lines = [];
    let current = "";
    for (const word of words) {
        if (current === "") {
            current = word;
        }
        else if (visibleLength(current) + 1 + visibleLength(word) <= width) {
            current = `${current} ${word}`;
        }
        else {
            lines.push(current);
            current = word;
        }
    }
    if (current !== "")
        lines.push(current);
    const result = [];
    for (const line of lines) {
        if (visibleLength(line) <= width) {
            result.push(line);
            continue;
        }
        let rest = line;
        while (visibleLength(rest) > width) {
            result.push(rest.slice(0, width));
            rest = rest.slice(width);
        }
        if (rest !== "")
            result.push(rest);
    }
    return result;
}
/**
 * Render a box-drawing table. Column widths are the max of header and cell
 * visible lengths, capped at `column.max` (never below the header length), and
 * shrunk (widest-first, never below header length) until the whole table fits
 * within `maxWidth`. Cells are truncated before color is applied so ANSI codes
 * are never split. One `\n` per line, no trailing blank line.
 */
export function renderTable(columns, rows, opts) {
    if (columns.length === 0)
        return "";
    const ascii = opts?.ascii === true;
    const terminalColumns = typeof process.stdout.columns === "number" && process.stdout.columns > 0
        ? process.stdout.columns
        : 120;
    const maxWidth = opts?.maxWidth ?? terminalColumns;
    const n = columns.length;
    const headerLengths = columns.map((column) => visibleLength(column.header));
    const widths = columns.map((column, i) => {
        let width = headerLengths[i];
        for (const row of rows) {
            const cell = row[i];
            if (cell)
                width = Math.max(width, visibleLength(cell.text));
        }
        const cap = column.max ?? 32;
        return Math.max(headerLengths[i], Math.min(width, cap));
    });
    // Total rendered width: cells padded with one space each side, one `|` per
    // column plus one leading and one trailing border char.
    let total = widths.reduce((sum, w) => sum + w, 0) + 3 * n + 1;
    while (total > maxWidth) {
        let widest = -1;
        let widestIndex = -1;
        for (let i = 0; i < n; i++) {
            if (widths[i] > headerLengths[i] && widths[i] > widest) {
                widest = widths[i];
                widestIndex = i;
            }
        }
        if (widestIndex === -1)
            break;
        widths[widestIndex]--;
        total--;
    }
    const h = ascii ? "-" : "─";
    const v = ascii ? "|" : "│";
    const [tl, tm, tr] = ascii ? ["+", "+", "+"] : ["┌", "┬", "┐"];
    const [ml, mm, mr] = ascii ? ["+", "+", "+"] : ["├", "┼", "┤"];
    const [bl, bm, br] = ascii ? ["+", "+", "+"] : ["└", "┴", "┘"];
    const border = (left, mid, right) => left + widths.map((w) => h.repeat(w + 2)).join(mid) + right;
    const renderRow = (cells) => {
        const rendered = columns.map((column, i) => {
            const cell = cells[i];
            const width = widths[i];
            const text = cell ? truncate(cell.text, width, ascii) : "";
            const styled = color(text, ...(cell?.color ?? []));
            const pad = " ".repeat(Math.max(0, width - visibleLength(styled)));
            return column.align === "right" ? pad + styled : styled + pad;
        });
        return `${v} ${rendered.join(` ${v} `)} ${v}`;
    };
    const header = renderRow(columns.map((column) => ({ text: column.header, color: colorEnabled() ? ["bold"] : undefined })));
    const lines = [border(tl, tm, tr), header];
    if (rows.length > 0) {
        lines.push(border(ml, mm, mr));
        for (const row of rows)
            lines.push(renderRow(row));
    }
    lines.push(border(bl, bm, br));
    return `${lines.join("\n")}\n`;
}
/** Map a model status to a badge label and color. Absent/`"ga"` → GA. */
export function statusBadge(status) {
    switch (status) {
        case undefined:
        case "ga":
            return { text: "GA", color: ["green"] };
        case "alpha":
            return { text: "alpha", color: ["cyan"] };
        case "beta":
            return { text: "beta", color: ["yellow"] };
        case "deprecated":
            return { text: "deprecated", color: ["red"] };
        default:
            return { text: status, color: undefined };
    }
}
/** A table cell for a USD-per-1M cost. Missing/NaN renders gray; 0 is green. */
export function costCell(costInput, ascii = false) {
    if (costInput === undefined || Number.isNaN(costInput)) {
        return { text: ascii ? "-" : "—", color: ["gray"] };
    }
    if (costInput === 0)
        return { text: "$0.00", color: ["green"] };
    return { text: formatCostUSD(costInput), color: undefined };
}
//# sourceMappingURL=format.js.map