# mdev-sdk

[![npm version](https://img.shields.io/npm/v/mdev-sdk)](https://www.npmjs.com/package/mdev-sdk)
[![npm downloads](https://img.shields.io/npm/dm/mdev-sdk)](https://www.npmjs.com/package/mdev-sdk)
[![license](https://img.shields.io/npm/l/mdev-sdk)](https://github.com/your-org/mdev-sdk/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

> Badges show "not found" until the package is published to npm — that's
> expected.

A zero-dependency, strictly-typed TypeScript SDK for the [models.dev](https://models.dev)
public API — the open catalog of AI providers and models maintained by the
SST / Anomaly team.

> **Package name note**: this package is published to npm as `mdev-sdk`. The
> CLI binary it ships is `modelsdev` (installed via the `bin` field) — the
> package name and the binary name are intentionally different.

## Features

- **Zero runtime dependencies** — no zod, axios, commander, dayjs, nothing.
- **Fully typed** — every endpoint maps to a TypeScript interface
  (`api.json`, `models.json`, `catalog.json`, `model-schema.json`).
- **Caching** — in-memory TTL cache (1h by default, mirroring the server's
  `Cache-Control: public, max-age=3600`) plus concurrent in-flight request
  deduplication, with `AbortSignal` support.
- **Offline snapshots** — `npm run snapshot` downloads the catalog once;
  `loadSnapshot()` reads it back with zero network access.
- **Query layer** — pure filter/search/sort helpers over fetched data, and
  pricing math that treats *absent* prices correctly (absence ≠ free).
- **CLI** — a small `modelsdev` binary for exploring the catalog.

Requires **Node.js >= 18**.

## Install

```bash
npm install mdev-sdk
```

## Quickstart

```ts
import {
  ModelsDevClient,
  filterModels,
  searchModels,
  loadSnapshot,
} from "mdev-sdk";

const client = new ModelsDevClient();

// 1. The full catalog in one request: { providers, models }.
const catalog = await client.catalog();

// 2. Cheap reasoning models, sorted by input price (unpriced models last).
const cheapReasoning = filterModels(catalog.providers, {
  capabilities: { reasoning: true },
  maxInputCost: 1, // USD per 1M input tokens
}).sort((a, b) => compareInputCost(a.model, b.model));
console.log(cheapReasoning.slice(0, 5).map((m) => `${m.providerId}/${m.model.id}`));

// 3. Look up a single model by canonical id.
const hit = await client.model("anthropic/claude-opus-4-6");
console.log(hit?.model.cost?.input); // USD per 1M input tokens (undefined = unpriced)

// 4. Search the provider-agnostic metadata map.
const metadata = await client.models();
console.log(searchModels(metadata, "llama").map((m) => m.id));

// 5. Offline: load a previously downloaded snapshot (no network).
const snapshot = await loadSnapshot("./snapshot");
```

## API reference

### Client

```ts
new ModelsDevClient(options?: ClientOptions)
makeClient(options?: ClientOptions) // factory equivalent
```

`ClientOptions`:

| option    | default                | description                                                        |
| --------- | ---------------------- | ------------------------------------------------------------------ |
| `baseUrl` | `"https://models.dev"` | base URL for the API (trailing slash is stripped)                  |
| `fetch`   | `globalThis.fetch`     | custom fetch implementation (tests, proxies, workers)              |
| `headers` | `{}`                   | extra headers sent with every request (an `accept: application/json` default is merged in) |
| `ttlMs`   | `3_600_000` (1h)       | in-memory cache lifetime; `0` disables caching                     |

Methods:

| method                          | endpoint             | returns                                        |
| ------------------------------- | -------------------- | ---------------------------------------------- |
| `providers(opts?)`              | `/api.json`          | `Promise<ProviderMap>`                         |
| `models(opts?)`                 | `/models.json`       | `Promise<ModelMetadataMap>`                    |
| `catalog(opts?)`                | `/catalog.json`      | `Promise<Catalog>`                             |
| `modelSchema(opts?)`            | `/model-schema.json` | `Promise<ModelSchema>`                         |
| `provider(id)`                  | —                    | `Promise<Provider \| undefined>`               |
| `model(canonicalId)`            | —                    | `Promise<{ provider, model } \| undefined>`    |
| `providerIds()`                 | —                    | `Promise<string[]>` (sorted)                   |
| `clearCache()`                  | —                    | `void`                                         |

Per-request `opts?: { signal?: AbortSignal; ttlMs?: number }` override the client
defaults. `model()` throws `ModelsDevError` (reason `NotFound`) for malformed ids
(no `/`); unknown but well-formed ids return `undefined`.

All failures collapse into a single error class:

```ts
class ModelsDevError extends Error {
  reason: "Transport" | "UnexpectedStatus" | "MalformedResponse" | "NotFound";
  status?: number; // HTTP status for "UnexpectedStatus"
  cause?: unknown;
}
```

### Filters and search (pure, no I/O)

```ts
interface ModelFilter {
  providers?: string[];
  search?: string; // case-insensitive substring match on id/name/family
  capabilities?: {
    attachment?: boolean;
    reasoning?: boolean;
    toolCall?: boolean;
    structuredOutput?: boolean;
    temperature?: boolean;
    openWeights?: boolean;
  };
  modalities?: { input?: Modality[]; output?: Modality[] }; // required ⊆ present
  minContext?: number;      // inclusive, tokens
  maxContext?: number;      // inclusive, tokens
  maxInputCost?: number;    // USD per 1M tokens; unpriced models excluded
  maxOutputCost?: number;   // USD per 1M tokens; unpriced models excluded
  status?: "alpha" | "beta" | "deprecated"; // absent status (GA) never matches
}

filterModels(providers: ProviderMap, filter?: ModelFilter): ModelMatch[]
// ModelMatch = { providerId, provider, model }

searchModels(models: ModelMetadataMap, query: string): ModelMetadata[]
// relevance order: exact id match → id prefix → substring (id/name/family)

listProviders(providers: ProviderMap): Provider[] // sorted by name
```

### Pricing helpers

```ts
formatCostUSD(n: number): string;                        // "$5.00", keeps digits for sub-cent prices
estimateCostPer1M(model, inputTokens, outputTokens): number | undefined;
compareInputCost(a, b): number;                          // ascending; unpriced last
compareOutputCost(a, b): number;                         // ascending; unpriced last
costTiersFor(model, contextSize): CostTier | undefined;  // largest tier.size <= contextSize
```

`estimateCostPer1M` returns `undefined` when the model has **no `cost`** —
absence of a price is not the same as free (`cost: { input: 0, output: 0 }` is
the explicit "free" form).

### Ids and dates

```ts
parseCanonicalId("a/b/c"); // { provider: "a", model: "b/c" } — split on FIRST slash
isCanonicalId(id): boolean;
canonicalId("a", "b");     // "a/b"

normalizeDate("2024-05");  // "2024-05-01"
compareDates(a, b): number;
sortDates(values, order?): string[];
```

### Offline snapshots

```ts
import { loadSnapshot } from "mdev-sdk/snapshot";
const snapshot: Snapshot = await loadSnapshot("./snapshot"); // Snapshot extends Catalog { generatedAt? }
```

See [Offline snapshots](#offline-snapshots) below.

## CLI

```bash
npx modelsdev providers --search anthropic
npx modelsdev search claude --min-context 200000 --max-input-cost 5
npx modelsdev info anthropic/claude-opus-4-6
npx modelsdev snapshot
npx modelsdev --help
```

Commands print aligned tables with ANSI colors by default. Colors are
auto-disabled when output is piped or redirected, or when `NO_COLOR` is set;
`--no-color` forces them off explicitly. On legacy consoles that mangle the
box-drawing borders (e.g. Windows cp1252), pass `--ascii` for plain
`+ - |` decorations and a `-`/`...` fallback for unicode symbols.

| Flag                     | Meaning                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `--search <text>`        | only show providers whose id or name contains `<text>`         |
| `--limit N`              | maximum number of results to print (default 20)                |
| `--min-context N`        | minimum context window in tokens                               |
| `--max-input-cost N`     | maximum input price in USD per 1M tokens                       |
| `--json`                 | print raw JSON instead of human-readable output                |
| `--no-color`             | disable ANSI colors                                            |
| `--ascii`                | ASCII-only decorations (for legacy consoles)                   |
| `-h, --help`             | show help                                                      |

Example output (`--ascii`):

```
+----------------------------------+----------------------+-----------+-----------+----------+--------+
| Model                            | Name                 |   Context | In $/1M   | Out $/1M | Status |
+----------------------------------+----------------------+-----------+-----------+----------+--------+
| anthropic/claude-opus-4-6        | Claude Opus 4.6      | 1,000,000 |     $5.00 |   $25.00 | GA     |
| anthropic/claude-sonnet-4-5      | Claude Sonnet 4.5    | 1,000,000 |     $3.00 |   $15.00 | beta   |
+----------------------------------+----------------------+-----------+-----------+----------+--------+
```

Sample layout only — real output sizes columns to the data. In the `In/Out $/1M`
columns, models whose cost is absent show `—` (or `-` with `--ascii`).

Output is human-readable by default; pass `--json` for raw JSON (unchanged by
color settings, always byte-stable). Results are capped at 20 by default
(`--limit N`), with a `… and N more` note. Errors go to stderr with a non-zero
exit code.

## Caching

The client keeps an in-memory cache keyed by endpoint URL with a 1h TTL by
default — the same lifetime the server advertises via
`Cache-Control: public, max-age=3600`. Because the upstream data is updated
roughly hourly, the 1h TTL is a safe freshness window; per-model
`last_updated` is the precise freshness signal.

- `new ModelsDevClient({ ttlMs: 0 })` or `providers({ ttlMs: 0 })` bypass the cache.
- `client.clearCache()` drops all cached responses.
- Concurrent calls for the same endpoint share one in-flight request. A caller
  that did not start the shared request gets its own `AbortSignal` honored for
  *its own* promise only — the shared request is not cancelled for others.

## Offline snapshots

The full catalog is ~1–3 MB, so it is **not** embedded in the package. Instead,
download it once and read it back offline:

```bash
npm run snapshot      # or: npx modelsdev snapshot
# writes ./snapshot/{api.json, models.json, catalog.json, model-schema.json, meta.json}
```

```ts
import { loadSnapshot } from "mdev-sdk/snapshot";
const snapshot = await loadSnapshot("./snapshot"); // { providers, models, generatedAt? }
```

`loadSnapshot` reads `catalog.json` (falling back to `api.json` + `models.json`)
and throws a helpful `ModelsDevError` (reason `NotFound`) if the directory is
empty. The `snapshot/` directory is gitignored.

## Data model notes

- Canonical ids are `"<provider>/<model>"`. In `api.json` a provider's `models`
  are keyed by the provider-scoped id *without* the prefix; the full id is
  `providerId + "/" + modelId`. The same physical model appears under many
  providers, each with its own `cost`/`limit`.
- `cost` is **absent** (not zero) for unpriced models. Absence ≠ free.
- Dates (`knowledge`, `release_date`, `last_updated`, benchmark `date`) are
  `YYYY-MM` or `YYYY-MM-DD` — normalize with `normalizeDate` before comparing.
- `ModelMetadata.limit.output` is optional and can be missing. In `api.json`
  models `limit.output` is required.
- `interleaved` is `true` **or** `{ field: "reasoning_content" | "reasoning_details" }`.
- Benchmark `score` is `number | string` — stringify before rendering.
- `reasoning === true` implies `reasoning_options` is present; `reasoning === false`
  implies it is absent and `cost.reasoning` is forbidden.
- `status` absent = GA. Values: `"alpha" | "beta" | "deprecated"`.
- Embedding models: `limit.output: 1`, `tool_call: false`, `temperature: false`.
  Audio models can be input-audio-only; modality `"pdf"` is first-class.
- `cost.tiers` (`CostTier[]`) apply per context size;
  `context_over_200k` is a legacy long-context surcharge.
- `Provider.env` holds env var names, `Provider.npm` the AI SDK provider
  package, and `Provider.api` (base URL) exists only for
  openai-compatible-style providers.
- Data is **eventually consistent**: the upstream catalog is re-synced roughly
  hourly. `last_updated` per model is the freshness signal.

## Differences from `@opencode-ai/models`

The official npm SDK (`@opencode-ai/models`) is a minimal fetch-only client
(three methods, no query layer). This package is an independent, richer
implementation:

|                                | `@opencode-ai/models` | `mdev-sdk` |
| ------------------------------ | --------------------- | ---------------- |
| runtime dependencies           | none                 | none             |
| endpoints covered              | 3                    | 4 (+ schema)     |
| typed query/filter layer       | no                   | yes              |
| pricing helpers                | no                   | yes              |
| in-memory TTL cache + dedup    | no                   | yes              |
| offline snapshots              | no                   | yes              |
| CLI                            | no                   | yes              |

No code is shared between the two packages.

## Attribution

The upstream catalog data (https://models.dev) is MIT licensed,
Copyright (c) models.dev contributors (SST / Anomaly). This SDK is MIT
licensed — see [LICENSE](./LICENSE).
