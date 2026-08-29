/** Options for {@link downloadSnapshot}. */
export interface DownloadSnapshotOptions {
    /** Directory to write into. Defaults to `./snapshot` (relative to cwd). */
    dir?: string;
    /** Base URL. Defaults to `"https://models.dev"`. */
    baseUrl?: string;
    /** Custom fetch (mainly for tests). */
    fetch?: typeof globalThis.fetch;
}
/** Result of {@link downloadSnapshot}. */
export interface DownloadSnapshotResult {
    dir: string;
    generatedAt: string;
    files: string[];
}
/**
 * Download the models.dev JSON endpoints into a local snapshot directory that
 * can later be loaded offline with `loadSnapshot()`.
 *
 * Writes `api.json`, `models.json`, `catalog.json`, `model-schema.json`, and a
 * small `meta.json` holding the `generatedAt` timestamp.
 */
export declare function downloadSnapshot(options?: DownloadSnapshotOptions): Promise<DownloadSnapshotResult>;
//# sourceMappingURL=snapshot-script.d.ts.map