import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, MODEL, modelRequestOptions } from "../worker/models.js";

// The bug this file exists to prevent: `effort` is accepted on Opus 5 and
// Sonnet 5 and rejected with a 400 by Haiku 4.5, so changing the model string
// alone can break every parse in production while every other test still passes.

test("the configured model is one the table knows about", () => {
  assert.ok(MODELS[MODEL], `MODEL "${MODEL}" is missing from MODELS`);
});

test("effort is omitted, not nulled, for models that reject it", () => {
  const opts = modelRequestOptions("claude-haiku-4-5");
  assert.ok(!("effort" in opts), "Haiku 4.5 rejects effort — the key must be absent entirely");
  assert.ok(opts.max_tokens > 0);
});

test("effort is sent for models that accept it", () => {
  for (const model of ["claude-sonnet-5", "claude-opus-5"]) {
    assert.equal(modelRequestOptions(model).effort, "low", `${model} should send effort`);
  }
});

test("an unknown model degrades to the safe shape rather than throwing", () => {
  const opts = modelRequestOptions("claude-something-unreleased");
  assert.ok(!("effort" in opts), "unknown models must not be sent effort speculatively");
  assert.ok(opts.max_tokens > 0);
});

test("every entry carries the fields the eval's cost report needs", () => {
  for (const [name, spec] of Object.entries(MODELS)) {
    assert.ok(Number.isFinite(spec.priceIn), `${name} missing priceIn`);
    assert.ok(Number.isFinite(spec.priceOut), `${name} missing priceOut`);
    assert.ok(Number.isFinite(spec.maxTokens), `${name} missing maxTokens`);
    assert.ok(spec.effort === null || typeof spec.effort === "string");
  }
});

test("max_tokens leaves room for the largest realistic extraction", () => {
  // A five-ingredient meal with every est_* field populated is a few hundred
  // output tokens; models that think need considerably more headroom, since
  // max_tokens caps thinking and response text together.
  for (const [name, spec] of Object.entries(MODELS)) {
    const floor = spec.effort ? 4000 : 2000;
    assert.ok(spec.maxTokens >= floor, `${name} max_tokens=${spec.maxTokens} is too tight`);
  }
});
