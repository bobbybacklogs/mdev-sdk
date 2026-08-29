import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareInputCost, compareOutputCost, costTiersFor, estimateCostPer1M, formatCostUSD } from "../src/pricing.js";
import { providerMap } from "./fixtures/catalog.js";

const gpt4o = providerMap.openai!.models["gpt-4o"]!;
const gpt4oMini = providerMap.openai!.models["gpt-4o-mini"]!;
const llama = providerMap.ollama!.models["llama-3.2-3b"]!;
const qwen = providerMap.ollama!.models["qwen2.5-coder-7b"]!;
const sonnet = providerMap.anthropic!.models["claude-sonnet-4-5"]!;

describe("formatCostUSD", () => {
  it("formats whole and fractional dollar amounts", () => {
    assert.equal(formatCostUSD(5), "$5.00");
    assert.equal(formatCostUSD(0), "$0.00");
    assert.equal(formatCostUSD(0.15), "$0.15");
  });

  it("keeps significant digits for sub-cent prices", () => {
    assert.match(formatCostUSD(0.0000005), /^\$0\.00000/);
  });

  it("renders non-finite values as an em dash", () => {
    assert.equal(formatCostUSD(Number.NaN), "—");
  });
});

describe("estimateCostPer1M", () => {
  it("computes USD cost from token counts (prices are per 1M tokens)", () => {
    assert.equal(estimateCostPer1M(gpt4o, 1_000_000, 500_000), 7.5);
    assert.equal(estimateCostPer1M(gpt4oMini, 1_000, 500), 0.00045);
  });

  it("returns undefined when the model has no cost (absence is not free)", () => {
    assert.equal(estimateCostPer1M(llama, 1_000_000, 1_000_000), undefined);
  });
});

describe("compareInputCost", () => {
  it("sorts priced models ascending by input price", () => {
    assert.ok(compareInputCost(gpt4oMini, gpt4o) < 0);
    assert.ok(compareInputCost(gpt4o, gpt4oMini) > 0);
  });

  it("sorts unpriced models last", () => {
    assert.ok(compareInputCost(llama, gpt4o) > 0);
    assert.ok(compareInputCost(gpt4o, llama) < 0);
    assert.equal(compareInputCost(llama, qwen), 0);
  });
});

describe("compareOutputCost", () => {
  it("sorts by output price", () => {
    assert.ok(compareOutputCost(gpt4oMini, gpt4o) < 0);
  });
});

describe("costTiersFor", () => {
  it("returns undefined below the smallest tier (base cost applies)", () => {
    assert.equal(costTiersFor(sonnet, 100_000), undefined);
  });

  it("returns the largest tier whose size fits the context", () => {
    assert.equal(costTiersFor(sonnet, 200_000)?.tier.size, 200_000);
    assert.equal(costTiersFor(sonnet, 250_000)?.tier.size, 200_000);
    assert.equal(costTiersFor(sonnet, 2_000_000)?.tier.size, 1_000_000);
  });

  it("returns undefined for models without tiers", () => {
    assert.equal(costTiersFor(gpt4o, 1_000_000), undefined);
  });
});
