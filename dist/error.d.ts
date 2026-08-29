/**
 * The category of a failure surfaced by the SDK.
 *
 * - `"Transport"`           — the network request itself failed (DNS, connection, abort, ...)
 * - `"UnexpectedStatus"`    — the server answered with a non-2xx status
 * - `"MalformedResponse"`   — the response body was not valid JSON (or not a JSON object)
 * - `"NotFound"`            — a requested entity (or local snapshot) does not exist
 */
export type ModelsDevErrorReason = "Transport" | "UnexpectedStatus" | "MalformedResponse" | "NotFound";
/** Options for {@link ModelsDevError}. */
export interface ModelsDevErrorOptions {
    reason: ModelsDevErrorReason;
    /** HTTP status code, when the failure came from an HTTP response. */
    status?: number;
    /** The underlying error, when one is available. */
    cause?: unknown;
}
/**
 * Every failure produced by this SDK collapses into this error type, so
 * consumers only ever need to handle one error class.
 */
export declare class ModelsDevError extends Error {
    readonly reason: ModelsDevErrorReason;
    readonly status?: number;
    readonly cause?: unknown;
    constructor(message: string, options: ModelsDevErrorOptions);
}
//# sourceMappingURL=error.d.ts.map