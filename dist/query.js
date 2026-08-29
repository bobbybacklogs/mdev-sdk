/**
 * Pure, side-effect-free filtering over a fetched `ProviderMap` (from
 * `client.providers()` or `client.catalog()`). No I/O.
 */
export function filterModels(providers, filter = {}) {
    const providerIds = filter.providers ? new Set(filter.providers) : null;
    const search = filter.search?.toLowerCase();
    const results = [];
    for (const providerId of Object.keys(providers)) {
        if (providerIds && !providerIds.has(providerId))
            continue;
        const provider = providers[providerId];
        if (!provider)
            continue;
        for (const modelId of Object.keys(provider.models)) {
            const model = provider.models[modelId];
            if (!model)
                continue;
            if (matchesModel(modelId, model, filter, search)) {
                results.push({ providerId, provider, model });
            }
        }
    }
    return results;
}
function matchesModel(modelId, model, filter, search) {
    if (search) {
        const haystack = `${modelId} ${model.name} ${model.family ?? ""}`.toLowerCase();
        if (!haystack.includes(search))
            return false;
    }
    const caps = filter.capabilities;
    if (caps) {
        if (caps.attachment !== undefined && model.attachment !== caps.attachment)
            return false;
        if (caps.reasoning !== undefined && model.reasoning !== caps.reasoning)
            return false;
        if (caps.toolCall !== undefined && model.tool_call !== caps.toolCall)
            return false;
        if (caps.structuredOutput !== undefined && (model.structured_output ?? false) !== caps.structuredOutput)
            return false;
        if (caps.temperature !== undefined && (model.temperature ?? false) !== caps.temperature)
            return false;
        if (caps.openWeights !== undefined && model.open_weights !== caps.openWeights)
            return false;
    }
    const modalities = filter.modalities;
    if (modalities) {
        if (modalities.input && !containsAll(model.modalities.input, modalities.input))
            return false;
        if (modalities.output && !containsAll(model.modalities.output, modalities.output))
            return false;
    }
    if (filter.minContext !== undefined && model.limit.context < filter.minContext)
        return false;
    if (filter.maxContext !== undefined && model.limit.context > filter.maxContext)
        return false;
    const cost = model.cost;
    if (filter.maxInputCost !== undefined) {
        if (!cost || cost.input > filter.maxInputCost)
            return false;
    }
    if (filter.maxOutputCost !== undefined) {
        if (!cost || cost.output > filter.maxOutputCost)
            return false;
    }
    if (filter.status !== undefined && model.status !== filter.status)
        return false;
    return true;
}
/**
 * Search a `ModelMetadataMap` (from `client.models()`) with a case-insensitive
 * substring match on id, name, or family. Results are ordered by relevance:
 * exact id match first, then id prefix, then substring.
 */
export function searchModels(models, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return [];
    const scored = [];
    for (const metadata of Object.values(models)) {
        const id = metadata.id.toLowerCase();
        const name = metadata.name.toLowerCase();
        const family = (metadata.family ?? "").toLowerCase();
        let rank;
        if (id === q)
            rank = 0;
        else if (id.startsWith(q))
            rank = 1;
        else if (id.includes(q) || name.includes(q) || family.includes(q))
            rank = 2;
        else
            continue;
        scored.push({ metadata, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || a.metadata.id.localeCompare(b.metadata.id));
    return scored.map((entry) => entry.metadata);
}
/** All providers, sorted by display name. */
export function listProviders(providers) {
    return Object.values(providers).sort((a, b) => a.name.localeCompare(b.name));
}
function containsAll(haystack, needles) {
    return needles.every((modality) => haystack.includes(modality));
}
//# sourceMappingURL=query.js.map