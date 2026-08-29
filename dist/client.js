import { ModelsDevError } from "./error.js";
import { parseCanonicalId } from "./ids.js";
const DEFAULT_BASE_URL = "https://models.dev";
const DEFAULT_TTL_MS = 3_600_000;
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
    baseUrl;
    fetchFn;
    defaultHeaders;
    ttlMs;
    cache = new Map();
    inflight = new Map();
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.fetchFn = options.fetch ?? globalThis.fetch;
        this.defaultHeaders = { accept: "application/json", ...(options.headers ?? {}) };
        this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    }
    /** All providers with their provider-scoped models (`GET /api.json`). */
    providers(options) {
        return this.getJson("/api.json", options);
    }
    /** Provider-agnostic model metadata (`GET /models.json`). */
    models(options) {
        return this.getJson("/models.json", options);
    }
    /** Combined catalog: `{ providers, models }` (`GET /catalog.json`). */
    catalog(options) {
        return this.getJson("/catalog.json", options);
    }
    /** JSON Schema listing every valid `provider/model` id (`GET /model-schema.json`). */
    modelSchema(options) {
        return this.getJson("/model-schema.json", options);
    }
    /** Look up a single provider by id; `undefined` when it does not exist. */
    async provider(id) {
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
    async model(canonicalId) {
        const { provider: providerId, model: modelId } = parseCanonicalId(canonicalId);
        const providers = await this.providers();
        const provider = providers[providerId];
        if (!provider)
            return undefined;
        const model = provider.models[modelId];
        if (!model)
            return undefined;
        return { provider, model };
    }
    /** Sorted list of every provider id. */
    async providerIds() {
        const providers = await this.providers();
        return Object.keys(providers).sort();
    }
    /** Drop all cached responses. In-flight requests are not cancelled. */
    clearCache() {
        this.cache.clear();
    }
    getJson(path, options) {
        const url = `${this.baseUrl}${path}`;
        const ttl = options?.ttlMs ?? this.ttlMs;
        const cached = this.cache.get(url);
        if (cached !== undefined && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.value);
        }
        const existing = this.inflight.get(url);
        if (existing) {
            return withSignal(existing, options?.signal);
        }
        const request = this.fetchJson(url, options?.signal)
            .then((value) => {
            if (ttl > 0)
                this.cache.set(url, { value, expiresAt: Date.now() + ttl });
            return value;
        })
            .finally(() => {
            this.inflight.delete(url);
        });
        this.inflight.set(url, request);
        return withSignal(request, options?.signal);
    }
    async fetchJson(url, signal) {
        let response;
        try {
            response = await this.fetchFn(url, { headers: this.defaultHeaders, signal });
        }
        catch (error) {
            throw new ModelsDevError(`Failed to reach ${url}: ${error instanceof Error ? error.message : String(error)}`, { reason: "Transport", cause: error });
        }
        if (!response.ok) {
            let detail = "";
            try {
                detail = (await response.text()).slice(0, 200);
            }
            catch {
                // ignore body read failures; the status is the important part
            }
            throw new ModelsDevError(`GET ${url} failed with status ${response.status}${detail ? `: ${detail}` : ""}`, { reason: "UnexpectedStatus", status: response.status });
        }
        let data;
        try {
            data = await response.json();
        }
        catch (error) {
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
export function makeClient(options) {
    return new ModelsDevClient(options);
}
/**
 * Gate `promise` on an AbortSignal: the caller's promise rejects with an
 * `AbortError` if the signal fires, without cancelling a request shared with
 * other callers (unless this caller started it — then the signal is also
 * passed to `fetch`).
 */
function withSignal(promise, signal) {
    if (!signal)
        return promise;
    if (signal.aborted)
        return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(abortError());
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", onAbort);
        });
    });
}
function abortError() {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    return error;
}
//# sourceMappingURL=client.js.map