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
export function filterModels(providers: ProviderMap, filter: ModelFilter = {}): ModelMatch[] {
  const providerIds = filter.providers ? new Set(filter.providers) : null;
  const search = filter.search?.toLowerCase();
  const results: ModelMatch[] = [];

  for (const providerId of Object.keys(providers)) {
    if (providerIds && !providerIds.has(providerId)) continue;
    const provider = providers[providerId];
    if (!provider) continue;

    for (const modelId of Object.keys(provider.models)) {
      const model = provider.models[modelId];
      if (!model) continue;
      if (matchesModel(modelId, model, filter, search)) {
        results.push({ providerId, provider, model });
      }
    }
  }

  return results;
}

function matchesModel(
  modelId: string,
  model: Model,
  filter: ModelFilter,
  search: string | undefined,
): boolean {
  if (search) {
    const haystack = `${modelId} ${model.name} ${model.family ?? ""}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  const caps = filter.capabilities;
  if (caps) {
    if (caps.attachment !== undefined && model.attachment !== caps.attachment) return false;
    if (caps.reasoning !== undefined && model.reasoning !== caps.reasoning) return false;
    if (caps.toolCall !== undefined && model.tool_call !== caps.toolCall) return false;
    if (caps.structuredOutput !== undefined && (model.structured_output ?? false) !== caps.structuredOutput) return false;
    if (caps.temperature !== undefined && (model.temperature ?? false) !== caps.temperature) return false;
    if (caps.openWeights !== undefined && model.open_weights !== caps.openWeights) return false;
  }

  const modalities = filter.modalities;
  if (modalities) {
    if (modalities.input && !containsAll(model.modalities.input, modalities.input)) return false;
    if (modalities.output && !containsAll(model.modalities.output, modalities.output)) return false;
  }

  if (filter.minContext !== undefined && model.limit.context < filter.minContext) return false;
  if (filter.maxContext !== undefined && model.limit.context > filter.maxContext) return false;

  const cost = model.cost;
  if (filter.maxInputCost !== undefined) {
    if (!cost || cost.input > filter.maxInputCost) return false;
  }
  if (filter.maxOutputCost !== undefined) {
    if (!cost || cost.output > filter.maxOutputCost) return false;
  }

  if (filter.status !== undefined && model.status !== filter.status) return false;

  return true;
}

/**
 * Search a `ModelMetadataMap` (from `client.models()`) with a case-insensitive
 * substring match on id, name, or family. Results are ordered by relevance:
 * exact id match first, then id prefix, then substring.
 */
export function searchModels(models: ModelMetadataMap, query: string): ModelMetadata[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ metadata: ModelMetadata; rank: number }> = [];
  for (const metadata of Object.values(models)) {
    const id = metadata.id.toLowerCase();
    const name = metadata.name.toLowerCase();
    const family = (metadata.family ?? "").toLowerCase();

    let rank: number;
    if (id === q) rank = 0;
    else if (id.startsWith(q)) rank = 1;
    else if (id.includes(q) || name.includes(q) || family.includes(q)) rank = 2;
    else continue;

    scored.push({ metadata, rank });
  }

  scored.sort((a, b) => a.rank - b.rank || a.metadata.id.localeCompare(b.metadata.id));
  return scored.map((entry) => entry.metadata);
}

/** All providers, sorted by display name. */
export function listProviders(providers: ProviderMap): Provider[] {
  return Object.values(providers).sort((a, b) => a.name.localeCompare(b.name));
}

function containsAll(haystack: readonly Modality[], needles: readonly Modality[]): boolean {
  return needles.every((modality) => haystack.includes(modality));
}
