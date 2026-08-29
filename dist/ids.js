import { ModelsDevError } from "./error.js";
/**
 * Split a canonical model id (`"<provider>/<model>"`) on its FIRST `/`.
 *
 * A model id may itself contain slashes (e.g. `"ollama/llama3.1:8b"`), so only
 * the first slash separates provider from model.
 *
 * Throws a {@link ModelsDevError} (reason `"NotFound"`) when the id has no
 * slash or has an empty side, since such an id cannot refer to a real model.
 */
export function parseCanonicalId(id) {
    if (typeof id !== "string" || id.length === 0) {
        throw new ModelsDevError('Invalid canonical model id: expected "<provider>/<model>"', {
            reason: "NotFound",
        });
    }
    const slash = id.indexOf("/");
    if (slash === -1 || slash === 0 || slash === id.length - 1) {
        throw new ModelsDevError(`Invalid canonical model id "${id}": expected the form "<provider>/<model>" (a "/" is required, with non-empty sides)`, { reason: "NotFound" });
    }
    return { provider: id.slice(0, slash), model: id.slice(slash + 1) };
}
/** True when `id` looks like a canonical `"<provider>/<model>"` id. */
export function isCanonicalId(id) {
    if (typeof id !== "string")
        return false;
    const slash = id.indexOf("/");
    return slash > 0 && slash < id.length - 1;
}
/** Join a provider id and a provider-scoped model id into a canonical id. */
export function canonicalId(providerId, modelId) {
    return `${providerId}/${modelId}`;
}
//# sourceMappingURL=ids.js.map