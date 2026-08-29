import type { Catalog, Model, ModelMetadataMap, ModelSchema, Provider, ProviderMap } from "./types.js";
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
export declare class ModelsDevClient {
    private readonly baseUrl;
    private readonly fetchFn;
    private readonly defaultHeaders;
    private readonly ttlMs;
    private readonly cache;
    private readonly inflight;
    constructor(options?: ClientOptions);
    /** All providers with their provider-scoped models (`GET /api.json`). */
    providers(options?: RequestOptions): Promise<ProviderMap>;
    /** Provider-agnostic model metadata (`GET /models.json`). */
    models(options?: RequestOptions): Promise<ModelMetadataMap>;
    /** Combined catalog: `{ providers, models }` (`GET /catalog.json`). */
    catalog(options?: RequestOptions): Promise<Catalog>;
    /** JSON Schema listing every valid `provider/model` id (`GET /model-schema.json`). */
    modelSchema(options?: RequestOptions): Promise<ModelSchema>;
    /** Look up a single provider by id; `undefined` when it does not exist. */
    provider(id: string): Promise<Provider | undefined>;
    /**
     * Look up a single model by canonical id (`"provider/model"`).
     *
     * Returns the provider it belongs to plus the provider-scoped model, or
     * `undefined` when either does not exist. A malformed id (no `/`) throws a
     * {@link ModelsDevError} with reason `"NotFound"`.
     */
    model(canonicalId: string): Promise<{
        provider: Provider;
        model: Model;
    } | undefined>;
    /** Sorted list of every provider id. */
    providerIds(): Promise<string[]>;
    /** Drop all cached responses. In-flight requests are not cancelled. */
    clearCache(): void;
    private getJson;
    private fetchJson;
}
/** Convenience factory for {@link ModelsDevClient}. */
export declare function makeClient(options?: ClientOptions): ModelsDevClient;
//# sourceMappingURL=client.d.ts.map