import type { CostTier, Model } from "./types.js";

const PER_MILLION = 1_000_000;

/**
 * Format a USD price. Prices on models.dev are USD per 1M tokens, so most are
 * small; keep significant digits for sub-cent prices instead of rounding them
 * to "$0.00". Non-finite values render as an em dash.
 */
export function formatCostUSD(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (Math.abs(value) >= 0.01) return `$${value.toFixed(2)}`;
  // Very small per-1M prices: fixed-point notation with trailing zeros stripped.
  const fixed = value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
  return `$${fixed}`;
}

/**
 * Estimate the USD cost of a call, in dollars.
 *
 * `model.cost.input` / `model.cost.output` are USD per 1M tokens, so the token
 * counts are divided by 1M first. Returns `undefined` when the model has no
 * `cost` at all — absence of a price is NOT the same as free.
 */
export function estimateCostPer1M(model: Model, inputTokens: number, outputTokens: number): number | undefined {
  if (!model.cost) return undefined;
  return (model.cost.input * inputTokens + model.cost.output * outputTokens) / PER_MILLION;
}

/** Compare two models by input price (ascending); models without a price sort last. */
export function compareInputCost(a: Model, b: Model): number {
  return compareOptionalCost(a.cost?.input, b.cost?.input);
}

/** Compare two models by output price (ascending); models without a price sort last. */
export function compareOutputCost(a: Model, b: Model): number {
  return compareOptionalCost(a.cost?.output, b.cost?.output);
}

/**
 * The cost tier that applies when a request uses `contextSize` tokens: the tier
 * with the largest `tier.size` that is `<= contextSize`. Returns `undefined`
 * when the model has no tiers — the base `cost` applies instead.
 */
export function costTiersFor(model: Model, contextSize: number): CostTier | undefined {
  if (!model.cost?.tiers) return undefined;
  const applicable = model.cost.tiers
    .filter((tier) => contextSize >= tier.tier.size)
    .sort((a, b) => b.tier.size - a.tier.size);
  return applicable[0];
}

function compareOptionalCost(a: number | undefined, b: number | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}
