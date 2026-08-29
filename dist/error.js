/**
 * Every failure produced by this SDK collapses into this error type, so
 * consumers only ever need to handle one error class.
 */
export class ModelsDevError extends Error {
    reason;
    status;
    cause;
    constructor(message, options) {
        super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
        this.name = "ModelsDevError";
        this.reason = options.reason;
        if (options.status !== undefined)
            this.status = options.status;
        if (options.cause !== undefined)
            this.cause = options.cause;
    }
}
//# sourceMappingURL=error.js.map