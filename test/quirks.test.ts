import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalog, metadataMap, providerMap } from "./fixtures/catalog.js";

/**
 * These tests pin the data quirks of the live models.dev payloads (as
 * documented in the task spec) so the SDK keeps handling them correctly.
 */
describe("data quirks", () => {
  it("cost is absent (not zero) for unpriced models", () => {
    const llama = providerMap.ollama!.models["llama-3.2-3b"]!;
    assert.equal("cost" in llama, false);
    assert.equal(llama.cost, undefined);

    const gpt4o = providerMap.openai!.models["gpt-4o"]!;
    assert.ok(gpt4o.cost);
  });

  it("limit.output is optional in metadata", () => {
    const meta = metadataMap["openai/gpt-4o"]!;
    assert.equal(meta.limit?.output, undefined);
    assert.equal(meta.limit?.context, 128000);
  });

  it("interleaved can be an object or true", () => {
    const opus = providerMap.anthropic!.models["claude-opus-4-6"]!;
    assert.deepEqual(opus.interleaved, { field: "reasoning_content" });
    const sonnet = providerMap.anthropic!.models["claude-sonnet-4-5"]!;
    assert.equal(sonnet.interleaved, true);
  });

  it("benchmark scores can be strings or numbers", () => {
    const meta = metadataMap["openai/gpt-4o"]!;
    assert.equal(typeof meta.benchmarks?.[0]?.score, "string");
    assert.equal(typeof meta.benchmarks?.[1]?.score, "number");
  });

  it("dates may be YYYY-MM", () => {
    assert.match(metadataMap["openai/gpt-4o"]!.knowledge!, /^\d{4}-\d{2}$/);
  });

  it("reasoning implies reasoning_options; non-reasoning models have none and no cost.reasoning", () => {
    for (const provider of Object.values(providerMap)) {
      for (const model of Object.values(provider.models)) {
        if (model.reasoning) {
          assert.ok(model.reasoning_options, `${model.id} should have reasoning_options`);
        } else {
          assert.equal(model.reasoning_options, undefined);
          if (model.cost) assert.equal(model.cost.reasoning, undefined);
        }
      }
    }
  });

  it("embedding models have output limit 1 and no tool calls/temperature", () => {
    const embedding = providerMap.openai!.models["text-embedding-3-small"]!;
    assert.equal(embedding.limit.output, 1);
    assert.equal(embedding.tool_call, false);
    assert.equal(embedding.temperature, false);
  });

  it("cost.tiers exist with context sizes", () => {
    const sonnet = providerMap.anthropic!.models["claude-sonnet-4-5"]!;
    assert.ok(sonnet.cost?.tiers && sonnet.cost.tiers.length > 0);
    assert.equal(sonnet.cost.tiers[0]?.tier.type, "context");
  });

  it("catalog is the union of the two maps", () => {
    assert.equal(catalog.providers, providerMap);
    assert.equal(catalog.models, metadataMap);
  });
});
