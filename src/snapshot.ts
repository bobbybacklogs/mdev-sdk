import { readFile } from "node:fs/promises";
import path from "node:path";
import { ModelsDevError } from "./error.js";
import type { Catalog, ModelMetadataMap, ProviderMap } from "./types.js";

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
export async function loadSnapshot(dir = "./snapshot"): Promise<Snapshot> {
  const generatedAt = await readGeneratedAt(dir);

  const catalogPath = path.join(dir, "catalog.json");
  try {
    const catalog = await readJsonFile<Catalog>(catalogPath);
    if (!isCatalog(catalog)) {
      throw new ModelsDevError(`Snapshot file ${catalogPath} is not a catalog ({ providers, models })`, {
        reason: "MalformedResponse",
      });
    }
    return { ...catalog, generatedAt };
  } catch (error) {
    if (isMissingFile(error)) {
      // fall through to the api.json + models.json pair
    } else if (error instanceof ModelsDevError) {
      throw error;
    } else {
      throw new ModelsDevError(`Snapshot file ${catalogPath} is not valid JSON`, {
        reason: "MalformedResponse",
        cause: error,
      });
    }
  }

  const apiPath = path.join(dir, "api.json");
  const modelsPath = path.join(dir, "models.json");
  try {
    const [providers, models] = await Promise.all([
      readJsonFile<ProviderMap>(apiPath),
      readJsonFile<ModelMetadataMap>(modelsPath),
    ]);
    if (providers === null || typeof providers !== "object" || models === null || typeof models !== "object") {
      throw new ModelsDevError(`Snapshot files in ${dir} are not valid JSON objects`, {
        reason: "MalformedResponse",
      });
    }
    return { providers, models, generatedAt };
  } catch (error) {
    if (!isMissingFile(error)) {
      if (error instanceof ModelsDevError) throw error;
      throw new ModelsDevError(`Snapshot files in ${dir} are not valid JSON`, {
        reason: "MalformedResponse",
        cause: error,
      });
    }
  }

  throw new ModelsDevError(
    `No snapshot found in "${dir}". Run "npm run snapshot" (or "modelsdev snapshot") to download one.`,
    { reason: "NotFound" },
  );
}

async function readGeneratedAt(dir: string): Promise<string | undefined> {
  try {
    const raw = await readFile(path.join(dir, "meta.json"), "utf8");
    const meta = JSON.parse(raw) as { generatedAt?: unknown };
    return typeof meta.generatedAt === "string" ? meta.generatedAt : undefined;
  } catch {
    return undefined;
  }
}

async function readJsonFile<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

function isCatalog(value: Catalog): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.providers === "object" &&
    value.providers !== null &&
    typeof value.models === "object" &&
    value.models !== null
  );
}

function isMissingFile(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: unknown }).code === "ENOENT";
}
