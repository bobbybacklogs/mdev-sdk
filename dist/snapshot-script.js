import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ENDPOINTS = [
    { file: "api.json", path: "/api.json" },
    { file: "models.json", path: "/models.json" },
    { file: "catalog.json", path: "/catalog.json" },
    { file: "model-schema.json", path: "/model-schema.json" },
];
/**
 * Download the models.dev JSON endpoints into a local snapshot directory that
 * can later be loaded offline with `loadSnapshot()`.
 *
 * Writes `api.json`, `models.json`, `catalog.json`, `model-schema.json`, and a
 * small `meta.json` holding the `generatedAt` timestamp.
 */
export async function downloadSnapshot(options = {}) {
    const dir = options.dir ?? path.join(process.cwd(), "snapshot");
    const baseUrl = (options.baseUrl ?? "https://models.dev").replace(/\/+$/, "");
    const fetchFn = options.fetch ?? globalThis.fetch;
    await mkdir(dir, { recursive: true });
    const generatedAt = new Date().toISOString();
    const files = [];
    for (const endpoint of ENDPOINTS) {
        const url = `${baseUrl}${endpoint.path}`;
        const response = await fetchFn(url);
        if (!response.ok) {
            throw new Error(`GET ${url} returned ${response.status} ${response.statusText}`);
        }
        const body = await response.text();
        const filePath = path.join(dir, endpoint.file);
        await writeFile(filePath, `${body}\n`);
        files.push(filePath);
    }
    const metaPath = path.join(dir, "meta.json");
    await writeFile(metaPath, `${JSON.stringify({ generatedAt, source: baseUrl }, null, 2)}\n`);
    files.push(metaPath);
    return { dir, generatedAt, files };
}
async function main() {
    const result = await downloadSnapshot();
    console.log(`Snapshot written to ${result.dir} at ${result.generatedAt}`);
    for (const file of result.files) {
        console.log(`  ${path.relative(process.cwd(), file) || file}`);
    }
}
const isMainModule = process.argv[1] !== undefined && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url));
if (isMainModule) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
function samePath(a, b) {
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}
//# sourceMappingURL=snapshot-script.js.map