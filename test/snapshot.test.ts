import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ModelsDevError } from "../src/error.js";
import { loadSnapshot } from "../src/snapshot.js";
import { catalog, metadataMap, providerMap } from "./fixtures/catalog.js";

async function makeTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "modelsdev-sdk-"));
}

describe("loadSnapshot", () => {
  it("reads catalog.json and the generatedAt timestamp", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(path.join(dir, "catalog.json"), JSON.stringify(catalog));
      await writeFile(path.join(dir, "meta.json"), JSON.stringify({ generatedAt: "2026-01-01T00:00:00.000Z" }));

      const snapshot = await loadSnapshot(dir);
      assert.equal(snapshot.providers.anthropic?.name, "Anthropic");
      assert.equal(snapshot.models["openai/gpt-4o"]?.limit?.output, undefined); // quirk survives the round trip
      assert.equal(snapshot.generatedAt, "2026-01-01T00:00:00.000Z");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls back to api.json + models.json when catalog.json is missing", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(path.join(dir, "api.json"), JSON.stringify(providerMap));
      await writeFile(path.join(dir, "models.json"), JSON.stringify(metadataMap));

      const snapshot = await loadSnapshot(dir);
      assert.equal(Object.keys(snapshot.providers).length, 3);
      assert.equal(snapshot.models["anthropic/claude-opus-4-6"]?.family, "claude-opus");
      assert.equal(snapshot.generatedAt, undefined); // no meta.json
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws ModelsDevError(NotFound) with a hint when no snapshot exists", async () => {
    const dir = await makeTempDir();
    try {
      await assert.rejects(loadSnapshot(dir), (error: unknown) => {
        assert.ok(error instanceof ModelsDevError);
        assert.equal(error.reason, "NotFound");
        assert.match(error.message, /npm run snapshot/);
        return true;
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws ModelsDevError(MalformedResponse) for a broken catalog.json", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(path.join(dir, "catalog.json"), "{ not json");
      await assert.rejects(loadSnapshot(dir), (error: unknown) => {
        assert.ok(error instanceof ModelsDevError);
        assert.equal(error.reason, "MalformedResponse");
        return true;
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
