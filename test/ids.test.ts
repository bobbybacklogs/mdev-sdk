import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModelsDevError } from "../src/error.js";
import { canonicalId, isCanonicalId, parseCanonicalId } from "../src/ids.js";

describe("parseCanonicalId", () => {
  it("splits on the first slash", () => {
    assert.deepEqual(parseCanonicalId("anthropic/claude-opus-4-6"), {
      provider: "anthropic",
      model: "claude-opus-4-6",
    });
    // model ids may contain additional slashes; only the first one splits
    assert.deepEqual(parseCanonicalId("a/b/c"), { provider: "a", model: "b/c" });
  });

  it("throws ModelsDevError(NotFound) for ids without a slash", () => {
    assert.throws(
      () => parseCanonicalId("no-slash"),
      (error: unknown) => {
        assert.ok(error instanceof ModelsDevError);
        assert.equal(error.reason, "NotFound");
        return true;
      },
    );
    assert.throws(() => parseCanonicalId(""));
  });

  it("throws for empty sides", () => {
    assert.throws(() => parseCanonicalId("/foo"));
    assert.throws(() => parseCanonicalId("foo/"));
  });
});

describe("isCanonicalId", () => {
  it("accepts provider/model ids", () => {
    assert.equal(isCanonicalId("anthropic/claude-opus-4-6"), true);
  });

  it("rejects ids without a slash or with empty sides", () => {
    assert.equal(isCanonicalId(""), false);
    assert.equal(isCanonicalId("nope"), false);
    assert.equal(isCanonicalId("/nope"), false);
    assert.equal(isCanonicalId("nope/"), false);
  });
});

describe("canonicalId", () => {
  it("joins provider and model ids", () => {
    assert.equal(canonicalId("openai", "gpt-4o"), "openai/gpt-4o");
  });
});
