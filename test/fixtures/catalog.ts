import type { Catalog, ModelMetadataMap, ModelSchema, ProviderMap } from "../../src/types.js";

/**
 * Hand-written fixture that mirrors the REAL models.dev payload shapes,
 * including the documented data quirks:
 *  - `cost` absent (not zero) for unpriced models
 *  - metadata `limit.output` missing
 *  - `interleaved` as `true` OR `{ field }`
 *  - string benchmark scores
 *  - `YYYY-MM` dates
 *  - embedding model with `limit: { context, output: 1 }`
 *  - `cost.tiers`
 */

export const providerMap: ProviderMap = {
  openai: {
    id: "openai",
    env: ["OPENAI_API_KEY"],
    npm: "@ai-sdk/openai",
    api: "https://api.openai.com/v1",
    name: "OpenAI",
    doc: "https://platform.openai.com/docs",
    models: {
      "gpt-4o": {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Flagship multimodal model.",
        family: "gpt-4",
        attachment: true,
        reasoning: false,
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2024-05-13",
        last_updated: "2024-06-01",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: false,
        limit: { context: 128000, output: 4096 },
        cost: { input: 2.5, output: 10, cache_read: 1.25, cache_write: 2.5 },
      },
      "gpt-4o-mini": {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        description: "Small, cheap multimodal model.",
        attachment: true,
        reasoning: false,
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2024-07-18",
        last_updated: "2024-08-01",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: false,
        limit: { context: 128000, output: 4096 },
        cost: { input: 0.15, output: 0.6 },
      },
      "text-embedding-3-small": {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        description: "Embedding model.",
        attachment: false,
        reasoning: false,
        tool_call: false,
        structured_output: false,
        temperature: false,
        release_date: "2024-01-25",
        last_updated: "2024-02-01",
        modalities: { input: ["text"], output: ["text"] },
        open_weights: false,
        limit: { context: 2048, output: 1 }, // embedding quirk
        cost: { input: 0.02, output: 0 },
      },
    },
  },
  anthropic: {
    id: "anthropic",
    env: ["ANTHROPIC_API_KEY"],
    npm: "@ai-sdk/anthropic",
    name: "Anthropic",
    doc: "https://docs.anthropic.com",
    models: {
      "claude-opus-4-6": {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        description: "Anthropic's most capable model.",
        family: "claude-opus",
        attachment: true,
        reasoning: true,
        reasoning_options: [{ type: "toggle" }, { type: "effort", values: ["low", "medium", "high"] }],
        interleaved: { field: "reasoning_content" }, // interleaved-as-object quirk
        tool_call: true,
        structured_output: true,
        temperature: true,
        knowledge: "2025-06",
        release_date: "2025-06-09",
        last_updated: "2025-06-09",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: false,
        limit: { context: 200000, output: 32000 },
        status: "beta",
        cost: {
          input: 15,
          output: 75,
          reasoning: 150,
          cache_read: 1.5,
          cache_write: 18.75,
          context_over_200k: { input: 30, output: 150 }, // legacy long-context surcharge
        },
      },
      "claude-sonnet-4-5": {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        description: "Balanced reasoning model.",
        attachment: true,
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh"] }],
        interleaved: true, // interleaved-as-boolean quirk
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2025-03-20",
        last_updated: "2025-04-01",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: false,
        limit: { context: 200000, output: 64000 },
        cost: {
          input: 3,
          output: 15,
          cache_read: 0.3,
          cache_write: 3.75,
          tiers: [
            { input: 3.5, output: 17.5, tier: { type: "context", size: 200000 } },
            { input: 4, output: 20, tier: { type: "context", size: 1000000 } },
          ],
        },
      },
      "claude-haiku-4-5": {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "Fast, cheap model.",
        attachment: true,
        reasoning: true,
        reasoning_options: [
          { type: "toggle" },
          { type: "effort", values: ["low", "medium", "high"] },
          { type: "budget_tokens", min: 1024, max: 65536 },
        ],
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2024-10-15",
        last_updated: "2025-05-01",
        modalities: { input: ["text", "image"], output: ["text"] },
        open_weights: false,
        limit: { context: 200000, output: 8192 },
        status: "deprecated",
        cost: { input: 1, output: 5 },
      },
    },
  },
  ollama: {
    id: "ollama",
    env: [],
    npm: "@ai-sdk/ollama",
    name: "Ollama",
    doc: "https://ollama.com",
    models: {
      "llama-3.2-3b": {
        id: "llama-3.2-3b",
        name: "Llama 3.2 3B",
        description: "Small open-weights model.",
        family: "llama",
        attachment: false,
        reasoning: false,
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2024-09-25",
        last_updated: "2024-10-01",
        modalities: { input: ["text"], output: ["text"] },
        open_weights: true,
        limit: { context: 131072, output: 8192 },
        // NO cost — absence of a price is NOT free
      },
      "qwen2.5-coder-7b": {
        id: "qwen2.5-coder-7b",
        name: "Qwen2.5 Coder 7B",
        description: "Open coding model.",
        family: "qwen",
        attachment: false,
        reasoning: true,
        reasoning_options: [{ type: "toggle" }],
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2024-11-12",
        last_updated: "2024-11-12",
        modalities: { input: ["text"], output: ["text"] },
        open_weights: true,
        limit: { context: 32768, output: 4096 },
        // NO cost
      },
    },
  },
};

export const metadataMap: ModelMetadataMap = {
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    description: "Flagship multimodal model metadata.",
    family: "gpt-4",
    knowledge: "2024-05", // YYYY-MM date quirk
    release_date: "2024-05-13",
    last_updated: "2024-06-01",
    license: "Proprietary",
    modalities: { input: ["text", "image"], output: ["text"] },
    open_weights: false,
    limit: { context: 128000 }, // missing limit.output quirk
    links: [{ label: "Model card", url: "https://platform.openai.com/docs", type: "model_card" }],
    benchmarks: [
      { name: "MMLU", score: "88.7", metric: "5-shot" }, // string score quirk
      { name: "HumanEval", score: 90.2, metric: "pass@1" }, // numeric score
    ],
  },
  "openai/gpt-4o-mini": {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    description: "Small, cheap multimodal model metadata.",
    family: "gpt-4",
    knowledge: "2024-07",
    release_date: "2024-07-18",
    last_updated: "2024-08-01",
    license: "Proprietary",
    modalities: { input: ["text", "image"], output: ["text"] },
    open_weights: false,
    limit: { context: 128000 }, // missing limit.output quirk
  },
  "openai/text-embedding-3-small": {
    id: "openai/text-embedding-3-small",
    name: "text-embedding-3-small",
    description: "Embedding metadata.",
    family: "embedding",
    knowledge: "2024-01",
    release_date: "2024-01-25",
    last_updated: "2024-02-01",
    license: "Proprietary",
    modalities: { input: ["text"], output: ["text"] },
    open_weights: false,
    limit: { context: 2048, output: 1 }, // embedding metadata quirk
  },
  "anthropic/claude-opus-4-6": {
    id: "anthropic/claude-opus-4-6",
    name: "Claude Opus 4.6",
    description: "Metadata for Opus.",
    family: "claude-opus",
    knowledge: "2025-05",
    release_date: "2025-06-09",
    last_updated: "2025-06-09",
    license: "Proprietary",
    modalities: { input: ["text", "image"], output: ["text"] },
    open_weights: false,
    limit: { context: 200000, output: 32000 },
    links: [{ url: "https://docs.anthropic.com", type: "docs" }],
  },
  "ollama/llama-3.2-3b": {
    id: "ollama/llama-3.2-3b",
    name: "Llama 3.2 3B",
    description: "Open model metadata.",
    family: "llama",
    knowledge: "2024-09",
    release_date: "2024-09-25",
    last_updated: "2024-10-01",
    license: "Llama 3.2 Community License",
    modalities: { input: ["text"], output: ["text"] },
    open_weights: true,
    weights: [{ label: "Hugging Face", url: "https://huggingface.co/meta-llama/Llama-3.2-3B", format: "safetensors" }],
    limit: { context: 131072, output: 8192 },
  },
};

export const catalog: Catalog = { providers: providerMap, models: metadataMap };

export const modelSchema: ModelSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://models.dev/model-schema.json",
  $defs: {
    Model: {
      type: "string",
      enum: ["anthropic/claude-opus-4-6", "openai/gpt-4o", "openai/gpt-4o-mini"].sort(),
    },
  },
};
