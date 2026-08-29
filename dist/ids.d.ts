/** The two halves of a canonical `"<provider>/<model>"` id. */
export interface CanonicalId {
    provider: string;
    model: string;
}
/**
 * Split a canonical model id (`"<provider>/<model>"`) on its FIRST `/`.
 *
 * A model id may itself contain slashes (e.g. `"ollama/llama3.1:8b"`), so only
 * the first slash separates provider from model.
 *
 * Throws a {@link ModelsDevError} (reason `"NotFound"`) when the id has no
 * slash or has an empty side, since such an id cannot refer to a real model.
 */
export declare function parseCanonicalId(id: string): CanonicalId;
/** True when `id` looks like a canonical `"<provider>/<model>"` id. */
export declare function isCanonicalId(id: string): boolean;
/** Join a provider id and a provider-scoped model id into a canonical id. */
export declare function canonicalId(providerId: string, modelId: string): string;
//# sourceMappingURL=ids.d.ts.map