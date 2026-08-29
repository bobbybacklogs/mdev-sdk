import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterModels, listProviders, searchModels } from "../src/query.js";
import { metadataMap, providerMap } from "./fixtures/catalog.js";

describe("filterModels", () => {
  it("returns every model with no filter", () => {
    assert.equal(filterModels(providerMap).length, 8);
  });

  it("filters by provider ids", () => {
    const matches = filterModels(providerMap, { providers: ["openai"] });
    assert.equal(matches.length, 3);
    assert.ok(matches.every((match) => match.providerId === "openai"));
  });

  it("filters by search across full id, provider-scoped id, name, and family", () => {
    assert.equal(filterModels(providerMap, { search: "claude" }).length, 3);
    assert.equal(filterModels(providerMap, { search: "gpt-4o" }).length, 2);
    assert.equal(filterModels(providerMap, { search: "llama" }).length, 1);
    assert.equal(filterModels(providerMap, { search: "LLAMA" }).length, 1); // case-insensitive
    assert.equal(filterModels(providerMap, { search: "nope" }).length, 0);
  });

  it("filters by capabilities", () => {
    assert.equal(filterModels(providerMap, { capabilities: { reasoning: true } }).length, 4);
    assert.equal(filterModels(providerMap, { capabilities: { attachment: false } }).length, 3);
    assert.equal(filterModels(providerMap, { capabilities: { toolCall: false } }).length, 1);
    assert.equal(filterModels(providerMap, { capabilities: { structuredOutput: false } }).length, 1);
    assert.equal(filterModels(providerMap, { capabilities: { temperature: false } }).length, 1);
    assert.equal(filterModels(providerMap, { capabilities: { openWeights: true } }).length, 2);
  });

  it("filters by context window", () => {
    assert.equal(filterModels(providerMap, { minContext: 100_000 }).length, 6);
    assert.equal(filterModels(providerMap, { maxContext: 50_000 }).length, 2);
    assert.equal(filterModels(providerMap, { minContext: 300_000 }).length, 0);
  });

  it("filters by price; unpriced models are excluded", () => {
    assert.equal(filterModels(providerMap, { maxInputCost: 2 }).length, 3);
    assert.equal(filterModels(providerMap, { maxOutputCost: 1 }).length, 2);
  });

  it("filters by status (absent status is GA and never matches)", () => {
    const deprecated = filterModels(providerMap, { status: "deprecated" });
    assert.equal(deprecated.length, 1);
    assert.equal(deprecated[0]!.model.id, "claude-haiku-4-5");
    assert.equal(filterModels(providerMap, { status: "alpha" }).length, 0);
  });

  it("filters by required modalities (subset semantics)", () => {
    assert.equal(filterModels(providerMap, { modalities: { input: ["image"] } }).length, 5);
    assert.equal(filterModels(providerMap, { modalities: { output: ["text"] } }).length, 8);
    assert.equal(filterModels(providerMap, { modalities: { input: ["image", "audio"] } }).length, 0);
  });

  it("combines filters", () => {
    const matches = filterModels(providerMap, { search: "claude", capabilities: { reasoning: true } });
    assert.equal(matches.length, 3);
  });

  it("returns provider context with each match", () => {
    const matches = filterModels(providerMap, { search: "llama" });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.providerId, "ollama");
    assert.equal(matches[0]!.provider.name, "Ollama");
    assert.ok(matches[0]!.model.open_weights);
  });
});

describe("searchModels", () => {
  it("orders by relevance: exact id first, then prefix, then substring", () => {
    const results = searchModels(metadataMap, "openai/gpt-4o");
    assert.deepEqual(
      results.map((model) => model.id),
      ["openai/gpt-4o", "openai/gpt-4o-mini"],
    );
  });

  it("matches id prefixes before substrings", () => {
    const results = searchModels(metadataMap, "openai/");
    assert.deepEqual(
      results.map((model) => model.id),
      ["openai/gpt-4o", "openai/gpt-4o-mini", "openai/text-embedding-3-small"],
    );
  });

  it("matches substrings on id, name, and family", () => {
    assert.deepEqual(
      searchModels(metadataMap, "claude").map((model) => model.id),
      ["anthropic/claude-opus-4-6"],
    );
    assert.deepEqual(
      searchModels(metadataMap, "llama").map((model) => model.id),
      ["ollama/llama-3.2-3b"],
    );
    assert.equal(searchModels(metadataMap, "embedding").length, 1);
  });

  it("returns [] for empty or unmatched queries", () => {
    assert.deepEqual(searchModels(metadataMap, ""), []);
    assert.deepEqual(searchModels(metadataMap, "zzz-nope"), []);
  });
});

describe("listProviders", () => {
  it("sorts providers by name", () => {
    assert.deepEqual(
      listProviders(providerMap).map((provider) => provider.name),
      ["Anthropic", "Ollama", "OpenAI"],
    );
  });
});
