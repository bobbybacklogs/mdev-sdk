import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModelsDevClient } from "../src/client.js";
import { ModelsDevError } from "../src/error.js";
import { catalog, metadataMap, modelSchema, providerMap } from "./fixtures/catalog.js";

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

type FetchHandler = (url: string, init?: FetchInit) => Response | Promise<Response>;

function mockFetch(handler: FetchHandler): typeof globalThis.fetch {
  return (async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as typeof globalThis.fetch;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ModelsDevClient", () => {
  it("providers() parses the provider map", async () => {
    const client = new ModelsDevClient({ fetch: mockFetch(async () => jsonResponse(providerMap)), ttlMs: 0 });
    const providers = await client.providers();
    assert.equal(Object.keys(providers).length, 3);
    assert.equal(providers.anthropic?.npm, "@ai-sdk/anthropic");
    assert.equal(providers.openai?.api, "https://api.openai.com/v1");
    assert.equal(providers.anthropic?.models["claude-opus-4-6"]?.cost?.input, 15);
  });

  it("models(), catalog() and modelSchema() parse their endpoints", async () => {
    const client = new ModelsDevClient({
      fetch: mockFetch(async (url) => {
        if (url.endsWith("/models.json")) return jsonResponse(metadataMap);
        if (url.endsWith("/catalog.json")) return jsonResponse(catalog);
        if (url.endsWith("/model-schema.json")) return jsonResponse(modelSchema);
        if (url.endsWith("/api.json")) return jsonResponse(providerMap);
        return new Response("not found", { status: 404 });
      }),
      ttlMs: 0,
    });

    const models = await client.models();
    assert.equal(models["openai/gpt-4o"]?.limit?.context, 128000);
    assert.equal(models["openai/gpt-4o"]?.limit?.output, undefined); // quirk: output missing

    const cat = await client.catalog();
    assert.equal(cat.providers.anthropic?.models["claude-sonnet-4-5"]?.cost?.tiers?.length, 2);
    assert.equal(cat.models["anthropic/claude-opus-4-6"]?.family, "claude-opus");

    const schema = await client.modelSchema();
    assert.ok(Array.isArray(schema.$defs.Model.enum));
    assert.ok(schema.$defs.Model.enum.length > 0);
  });

  it("caches responses for the default 1h TTL", async () => {
    let calls = 0;
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        calls += 1;
        return jsonResponse(providerMap);
      }),
    });
    await client.providers();
    await client.providers();
    assert.equal(calls, 1);
  });

  it("ttlMs: 0 disables caching", async () => {
    let calls = 0;
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        calls += 1;
        return jsonResponse(providerMap);
      }),
      ttlMs: 0,
    });
    await client.providers();
    await client.providers();
    assert.equal(calls, 2);
  });

  it("refetches after the TTL expires", async () => {
    let calls = 0;
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        calls += 1;
        return jsonResponse(providerMap);
      }),
      ttlMs: 10,
    });
    await client.providers();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await client.providers();
    assert.equal(calls, 2);
  });

  it("per-request ttlMs overrides the client default", async () => {
    let calls = 0;
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        calls += 1;
        return jsonResponse(providerMap);
      }),
    });
    await client.providers({ ttlMs: 0 });
    await client.providers({ ttlMs: 0 });
    assert.equal(calls, 2);
  });

  it("deduplicates concurrent in-flight requests for the same endpoint", async () => {
    let calls = 0;
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        calls += 1;
        return jsonResponse(providerMap);
      }),
      ttlMs: 0,
    });
    const [a, b] = await Promise.all([client.providers(), client.providers()]);
    assert.equal(calls, 1);
    assert.equal(a, b); // both callers share the same resolved object
  });

  it("throws ModelsDevError(UnexpectedStatus) on non-2xx", async () => {
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => new Response("oops", { status: 503 })),
      ttlMs: 0,
    });
    await assert.rejects(client.providers(), (error: unknown) => {
      assert.ok(error instanceof ModelsDevError);
      assert.equal(error.reason, "UnexpectedStatus");
      assert.equal(error.status, 503);
      return true;
    });
  });

  it("throws ModelsDevError(MalformedResponse) on invalid JSON", async () => {
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => new Response("not json {", { status: 200 })),
      ttlMs: 0,
    });
    await assert.rejects(client.providers(), (error: unknown) => {
      assert.ok(error instanceof ModelsDevError);
      assert.equal(error.reason, "MalformedResponse");
      return true;
    });
  });

  it("throws ModelsDevError(MalformedResponse) when JSON is not an object", async () => {
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => jsonResponse([1, 2, 3])),
      ttlMs: 0,
    });
    await assert.rejects(client.providers(), (error: unknown) => {
      assert.ok(error instanceof ModelsDevError);
      assert.equal(error.reason, "MalformedResponse");
      return true;
    });
  });

  it("throws ModelsDevError(Transport) when fetch rejects", async () => {
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        throw new TypeError("fetch failed");
      }),
      ttlMs: 0,
    });
    await assert.rejects(client.providers(), (error: unknown) => {
      assert.ok(error instanceof ModelsDevError);
      assert.equal(error.reason, "Transport");
      return true;
    });
  });

  it("rejects with an AbortError when the caller's signal is already aborted", async () => {
    const client = new ModelsDevClient({ fetch: mockFetch(async () => jsonResponse(providerMap)), ttlMs: 0 });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(client.providers({ signal: controller.signal }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "AbortError");
      return true;
    });
  });

  it("provider() returns a provider or undefined", async () => {
    const client = new ModelsDevClient({ fetch: mockFetch(async () => jsonResponse(providerMap)), ttlMs: 0 });
    assert.equal((await client.provider("openai"))?.name, "OpenAI");
    assert.equal(await client.provider("does-not-exist"), undefined);
  });

  it("model() resolves a canonical id", async () => {
    const client = new ModelsDevClient({ fetch: mockFetch(async () => jsonResponse(providerMap)), ttlMs: 0 });
    const found = await client.model("anthropic/claude-opus-4-6");
    assert.ok(found);
    assert.equal(found.provider.name, "Anthropic");
    assert.equal(found.model.reasoning, true);
    assert.deepEqual(found.model.interleaved, { field: "reasoning_content" });

    assert.equal(await client.model("anthropic/nope"), undefined);
    assert.equal(await client.model("nope/claude-opus-4-6"), undefined);
  });

  it("model() throws ModelsDevError(NotFound) for a non-canonical id", async () => {
    const client = new ModelsDevClient({ fetch: mockFetch(async () => jsonResponse(providerMap)), ttlMs: 0 });
    await assert.rejects(client.model("no-slash-here"), (error: unknown) => {
      assert.ok(error instanceof ModelsDevError);
      assert.equal(error.reason, "NotFound");
      return true;
    });
  });

  it("providerIds() returns sorted ids", async () => {
    const client = new ModelsDevClient({ fetch: mockFetch(async () => jsonResponse(providerMap)), ttlMs: 0 });
    assert.deepEqual(await client.providerIds(), ["anthropic", "ollama", "openai"]);
  });

  it("clearCache() drops cached responses", async () => {
    let calls = 0;
    const client = new ModelsDevClient({
      fetch: mockFetch(async () => {
        calls += 1;
        return jsonResponse(providerMap);
      }),
    });
    await client.providers();
    await client.providers();
    assert.equal(calls, 1);
    client.clearCache();
    await client.providers();
    assert.equal(calls, 2);
  });

  it("normalizes a trailing slash on baseUrl", async () => {
    let called = "";
    const client = new ModelsDevClient({
      fetch: mockFetch(async (url) => {
        called = url;
        return jsonResponse(providerMap);
      }),
      ttlMs: 0,
      baseUrl: "https://models.dev/",
    });
    await client.providers();
    assert.equal(called, "https://models.dev/api.json");
  });

  it("sends default headers plus user headers", async () => {
    let seenHeaders: unknown;
    const client = new ModelsDevClient({
      fetch: mockFetch(async (_url, init) => {
        seenHeaders = init?.headers;
        return jsonResponse(providerMap);
      }),
      ttlMs: 0,
      headers: { "x-custom": "1" },
    });
    await client.providers();
    assert.deepEqual(seenHeaders, { accept: "application/json", "x-custom": "1" });
  });
});
