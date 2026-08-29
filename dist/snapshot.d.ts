import type { Catalog } from "./types.js";
/** A locally stored snapshot: the full catalog plus when it was captured. */
export interface Snapshot extends Catalog {
    /** ISO timestamp written by the `npm run snapshot` script. */
    generatedAt?: string;
}
/**
 * Load a snapshot previously written by `npm run snapshot` (or the CLI command
 * `modelsdev snapshot`) without making any network requests.
 *
 * Reads `{dir}/catalog.json`; falls back to `{dir}/api.json` + `{dir}/models.json`.
 * The `generatedAt` timestamp comes from `{dir}/meta.json` when present.
 *
 * Throws a {@link ModelsDevError} with reason `"NotFound"` (and a hint to run
 * the snapshot script) when no snapshot exists, or `"MalformedResponse"` when
 * a snapshot file exists but cannot be parsed.
 */
export declare function loadSnapshot(dir?: string): Promise<Snapshot>;
//# sourceMappingURL=snapshot.d.ts.map