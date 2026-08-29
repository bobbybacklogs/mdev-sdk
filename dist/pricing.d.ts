import type { CostTier, Model } from "./types.js";
/**
 * Format a USD price. Prices on models.dev are USD per 1M tokens, so most are
 * small; keep significant digits for sub-cent prices instead of rounding them
 * to "$0.00". Non-finite values render as an em dash.
 */
export declare function formatCostUSD(value: number): string;
/**
 * Estimate the USD cost of a call, in dollars.
 *
 * `model.cost.input` / `model.cost.output` are USD per 1M tokens, so the token
 * counts are divided by 1M first. Returns `undefined` when the model has no
 * `cost` at all — absence of a price is NOT the same as free.
 */
export declare function estimateCostPer1M(model: Model, inputTokens: number, outputTokens: number): number | undefined;
/** Compare two models by input price (ascending); models without a price sort last. */
export declare function compareInputCost(a: Model, b: Model): number;
/** Compare two models by output price (ascending); models without a price sort last. */
export declare function compareOutputCost(a: Model, b: Model): number;
/**
 * The cost tier that applies when a request uses `contextSize` tokens: the tier
 * with the largest `tier.size` that is `<= contextSize`. Returns `undefined`
 * when the model has no tiers — the base `cost` applies instead.
 */
export declare function costTiersFor(model: Model, contextSize: number): CostTier | undefined;
//# sourceMappingURL=pricing.d.ts.map