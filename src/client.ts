import { ModelsDevError } from "./error.js";
import { parseCanonicalId } from "./ids.js";
import type {
  Catalog,
  Model,
  ModelMetadataMap,
  ModelSchema,
  Provider,
  ProviderMap,
} from "./types.js";

/** Options for {@link ModelsDevClient}. */
export interface ClientOptions {
  /** Base URL of the models.dev API. Defaults to `"https://models.dev"`. */
  baseUrl?: string;
  /** Custom fetch implementation (e.g. for tests, proxies, or workers). */
  fetch?: typeof globalThis.fetch;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /**
   * Cache lifetime in milliseconds. Defaults to `3_600_000` (1 hour), mirroring
   * the server's `Cache-Control: public, max-age=3600`. Set to `0` to disable
   * caching.
   */
  ttlMs?: number;
}

/** Per-request overrides for {@link ModelsDevClient}. */
export interface RequestOptions {
  signal?: AbortSignal;
  ttlMs?: number;
}

const DEFAULT_BASE_URL = "https://models.dev";
const DEFAULT_TTL_MS = 3_600_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * A typed client for the models.dev public API.
 *
 * - All endpoints are cached in memory for {@link ClientOptions.ttlMs} (1h by
 *   default, mirroring the server's Cache-Control header).
 * - Concurrent requests for the same endpoint share one in-flight promise.
 * - `AbortSignal`s passed by callers are respected: they abort the underlying
 *   request when this caller started it, and reject this caller's promise
 *   otherwise.
 */
export class ModelsDevClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.defaultHeaders = { accept: "application/json", ...(options.headers ?? {}) };
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  /** All providers with their provider-scoped models (`GET /api.json`). */
  providers(options?: RequestOptions): Promise<ProviderMap> {
    return this.getJson("/api.json", options);
  }

  /** Provider-agnostic model metadata (`GET /models.json`). */
  models(options?: RequestOptions): Promise<ModelMetadataMap> {
    return this.getJson("/models.json", options);
  }

  /** Combined catalog: `{ providers, models }` (`GET /catalog.json`). */
  catalog(options?: RequestOptions): Promise<Catalog> {
    return this.getJson("/catalog.json", options);
  }

  /** JSON Schema listing every valid `provider/model` id (`GET /model-schema.json`). */
  modelSchema(options?: RequestOptions): Promise<ModelSchema> {
    return this.getJson("/model-schema.json", options);
  }

  /** Look up a single provider by id; `undefined` when it does not exist. */
  async provider(id: string): Promise<Provider | undefined> {
    const providers = await this.providers();
    return providers[id];
  }

  /**
   * Look up a single model by canonical id (`"provider/model"`).
   *
   * Returns the provider it belongs to plus the provider-scoped model, or
   * `undefined` when either does not exist. A malformed id (no `/`) throws a
   * {@link ModelsDevError} with reason `"NotFound"`.
   */
  async model(canonicalId: string): Promise<{ provider: Provider; model: Model } | undefined> {
    const { provider: providerId, model: modelId } = parseCanonicalId(canonicalId);
    const providers = await this.providers();
    const provider = providers[providerId];
    if (!provider) return undefined;
    const model = provider.models[modelId];
    if (!model) return undefined;
    return { provider, model };
  }

  /** Sorted list of every provider id. */
  async providerIds(): Promise<string[]> {
    const providers = await this.providers();
    return Object.keys(providers).sort();
  }

  /** Drop all cached responses. In-flight requests are not cancelled. */
  clearCache(): void {
    this.cache.clear();
  }

  private getJson<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const ttl = options?.ttlMs ?? this.ttlMs;

    const cached = this.cache.get(url);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value as T);
    }

    const existing = this.inflight.get(url);
    if (existing) {
      return withSignal(existing as Promise<T>, options?.signal);
    }

    const request = this.fetchJson(url, options?.signal)
      .then((value) => {
        if (ttl > 0) this.cache.set(url, { value, expiresAt: Date.now() + ttl });
        return value;
      })
      .finally(() => {
        this.inflight.delete(url);
      }) as Promise<T>;

    this.inflight.set(url, request);
    return withSignal(request, options?.signal);
  }

  private async fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(url, { headers: this.defaultHeaders, signal });
    } catch (error) {
      throw new ModelsDevError(
        `Failed to reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
        { reason: "Transport", cause: error },
      );
    }

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 200);
      } catch {
        // ignore body read failures; the status is the important part
      }
      throw new ModelsDevError(
        `GET ${url} failed with status ${response.status}${detail ? `: ${detail}` : ""}`,
        { reason: "UnexpectedStatus", status: response.status },
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new ModelsDevError(`Response from ${url} was not valid JSON`, {
        reason: "MalformedResponse",
        cause: error,
      });
    }

    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new ModelsDevError(`Response from ${url} was not a JSON object`, {
        reason: "MalformedResponse",
      });
    }

    return data;
  }
}

/** Convenience factory for {@link ModelsDevClient}. */
export function makeClient(options?: ClientOptions): ModelsDevClient {
  return new ModelsDevClient(options);
}

/**
 * Gate `promise` on an AbortSignal: the caller's promise rejects with an
 * `AbortError` if the signal fires, without cancelling a request shared with
 * other callers (unless this caller started it — then the signal is also
 * passed to `fetch`).
 */
function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}
