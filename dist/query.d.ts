import type { Modality, Model, ModelMetadata, ModelMetadataMap, Provider, ProviderMap } from "./types.js";
/** Boolean capability requirements. `true` requires the capability, `false` requires its absence. */
export interface ModelCapabilityFilter {
    attachment?: boolean;
    reasoning?: boolean;
    toolCall?: boolean;
    structuredOutput?: boolean;
    temperature?: boolean;
    openWeights?: boolean;
}
/**
 * Modality requirements with "required ⊆ present" semantics: every listed
 * modality must be supported, but the model may support more.
 */
export interface ModelModalityFilter {
    input?: Modality[];
    output?: Modality[];
}
/** Filters for {@link filterModels}. All present constraints must hold. */
export interface ModelFilter {
    /** Restrict to these provider ids. */
    providers?: string[];
    /** Case-insensitive substring match on the full id, provider-scoped id, name, or family. */
    search?: string;
    capabilities?: ModelCapabilityFilter;
    modalities?: ModelModalityFilter;
    /** Minimum context window in tokens, inclusive. */
    minContext?: number;
    /** Maximum context window in tokens, inclusive. */
    maxContext?: number;
    /** Maximum input price in USD per 1M tokens. Models without a price are excluded. */
    maxInputCost?: number;
    /** Maximum output price in USD per 1M tokens. Models without a price are excluded. */
    maxOutputCost?: number;
    /**
     * Only models with this status. An absent `status` means GA and never
     * matches a status filter.
     */
    status?: "alpha" | "beta" | "deprecated";
}
/** A single {@link filterModels} result, with the provider it belongs to. */
export interface ModelMatch {
    providerId: string;
    provider: Provider;
    model: Model;
}
/**
 * Pure, side-effect-free filtering over a fetched `ProviderMap` (from
 * `client.providers()` or `client.catalog()`). No I/O.
 */
export declare function filterModels(providers: ProviderMap, filter?: ModelFilter): ModelMatch[];
/**
 * Search a `ModelMetadataMap` (from `client.models()`) with a case-insensitive
 * substring match on id, name, or family. Results are ordered by relevance:
 * exact id match first, then id prefix, then substring.
 */
export declare function searchModels(models: ModelMetadataMap, query: string): ModelMetadata[];
/** All providers, sorted by display name. */
export declare function listProviders(providers: ProviderMap): Provider[];
//# sourceMappingURL=query.d.ts.map