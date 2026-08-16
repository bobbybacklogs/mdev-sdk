export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[]

export type ReasoningEffort = null | "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "default"

export interface ReasoningOptionToggle { type: "toggle" }
export interface ReasoningOptionEffort { type: "effort"; values: ReasoningEffort[] }
export interface ReasoningOptionBudgetTokens { type: "budget_tokens"; min?: number; max?: number }
export type ReasoningOption = ReasoningOptionToggle | ReasoningOptionEffort | ReasoningOptionBudgetTokens

export interface Cost {
  input: number; output: number;
  reasoning?: number; cache_read?: number; cache_write?: number;
  input_audio?: number; output_audio?: number
} // USD per 1M tokens

export interface CostTier extends Cost { tier: { type: "context"; size: number } }
export interface ModelCost extends Cost { context_over_200k?: Cost; tiers?: CostTier[] }

export type Modality = "text" | "audio" | "image" | "video" | "pdf"
export interface Modalities { input: Modality[]; output: Modality[] }

export interface Limit { context: number; input?: number; output: number }
export interface MetadataLimit { context: number; input?: number; output?: number }

export interface ModelLink {
  label?: string; url: string;
  type?: "announcement" | "blog" | "docs" | "license" | "model_card" | "paper" | "weights" | "other"
}
export interface ModelWeights { label?: string; url: string; format?: string; quantization?: string }
export interface BenchmarkResult {
  name: string; score: number | string;
  metric?: string; harness?: string; variant?: string; dataset?: string;
  version?: string; source?: string; date?: string
}

export interface ModelMetadata {
  id: string; name: string; description: string;
  family?: string; attachment?: boolean; reasoning?: boolean;
  tool_call?: boolean; structured_output?: boolean; temperature?: boolean;
  knowledge?: string; release_date?: string; last_updated?: string;
  modalities?: Modalities; open_weights?: boolean; limit?: MetadataLimit;
  license?: string; links?: ModelLink[]; weights?: ModelWeights[]; benchmarks?: BenchmarkResult[]
}

export interface Model {
  id: string; name: string; description: string;
  family?: string;
  attachment: boolean; reasoning: boolean;
  reasoning_options?: ReasoningOption[];
  tool_call: boolean;
  interleaved?: true | { field: "reasoning_content" | "reasoning_details" };
  structured_output?: boolean; temperature?: boolean; knowledge?: string;
  release_date: string; last_updated: string;
  modalities: Modalities; open_weights: boolean; limit: Limit;
  status?: "alpha" | "beta" | "deprecated";
  experimental?: ModelExperimental; provider?: ModelProviderConfig; cost?: ModelCost
}

export interface ExperimentalMode {
  cost?: Cost
  provider?: { body?: Record<string, JsonValue>; headers?: Record<string, string> }
}
export interface ModelExperimental { modes?: Record<string, ExperimentalMode> }
export interface ModelProviderConfig {
  npm?: string; api?: string
  shape?: "responses" | "completions"
  body?: Record<string, JsonValue>; headers?: Record<string, string>
}

export interface Provider {
  id: string; env: string[]; npm: string; api?: string;
  name: string; doc: string; models: Record<string, Model>
}

export type ProviderMap = Record<string, Provider>
export type ModelMetadataMap = Record<string, ModelMetadata>
export interface Catalog { providers: ProviderMap; models: ModelMetadataMap }

export interface ModelSchema {
  $schema: string;
  $id: string;
  $defs: { Model: { type: "string"; enum: string[] } };
}
