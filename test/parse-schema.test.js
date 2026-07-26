import { test } from "node:test";
import assert from "node:assert/strict";
import { PARSE_SCHEMA, SYSTEM_PROMPT } from "../worker/parse-schema.js";
import { ACTIVITIES } from "../src/lib/exercise.js";

// Structured outputs reject a schema that breaks these rules with a 400 at
// request time, which would be a runtime failure in production rather than a
// build failure here. Walking the schema catches it at test time instead.

const SUPPORTED_TYPES = new Set([
  "object", "array", "string", "integer", "number", "boolean", "null",
]);
const UNSUPPORTED_KEYWORDS = [
  "minimum", "maximum", "multipleOf", "minLength", "maxLength",
  "minItems", "maxItems", "uniqueItems", "pattern", "patternProperties",
];

function walk(node, path, visit) {
  if (!node || typeof node !== "object") return;
  visit(node, path);
  if (node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      walk(child, `${path}.${key}`, visit);
    }
  }
  if (node.items) walk(node.items, `${path}[]`, visit);
  for (const kw of ["anyOf", "allOf", "oneOf"]) {
    if (Array.isArray(node[kw])) {
      node[kw].forEach((child, i) => walk(child, `${path}.${kw}[${i}]`, visit));
    }
  }
}

test("every object sets additionalProperties: false", () => {
  walk(PARSE_SCHEMA, "root", (node, path) => {
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, `${path} must set additionalProperties: false`);
    }
  });
});

test("every object property is listed in required", () => {
  walk(PARSE_SCHEMA, "root", (node, path) => {
    if (node.type !== "object" || !node.properties) return;
    const props = Object.keys(node.properties).sort();
    const required = [...(node.required || [])].sort();
    assert.deepEqual(required, props, `${path} required must list every property`);
  });
});

test("only supported types and keywords appear", () => {
  walk(PARSE_SCHEMA, "root", (node, path) => {
    if (node.type) {
      assert.ok(SUPPORTED_TYPES.has(node.type), `${path} uses unsupported type "${node.type}"`);
    }
    for (const kw of UNSUPPORTED_KEYWORDS) {
      assert.ok(!(kw in node), `${path} uses unsupported keyword "${kw}"`);
    }
  });
});

test("the schema is not recursive", () => {
  const seen = new Set();
  let recursive = false;
  (function descend(node) {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) {
      recursive = true;
      return;
    }
    seen.add(node);
    Object.values(node).forEach((v) => {
      if (Array.isArray(v)) v.forEach(descend);
      else descend(v);
    });
    seen.delete(node);
  })(PARSE_SCHEMA);
  assert.equal(recursive, false);
});

test("optional fields are expressed as a nullable union", () => {
  // The model must be able to say "not applicable" for every cross-kind field,
  // since one schema covers meals, exercise and weigh-ins.
  const entry = PARSE_SCHEMA.properties.entries.items;
  for (const key of ["slot", "ingredients", "activity", "distance_mi", "duration_min", "elev_ft", "weight_lb"]) {
    const prop = entry.properties[key];
    assert.ok(prop.anyOf, `${key} must be nullable`);
    assert.ok(
      prop.anyOf.some((s) => s.type === "null"),
      `${key} must allow null`,
    );
  }
});

test("kind is constrained to the three record types the app stores", () => {
  assert.deepEqual(PARSE_SCHEMA.properties.entries.items.properties.kind.enum, [
    "meal", "exercise", "weight",
  ]);
});

test("the activity list in the prompt matches the activities the app implements", () => {
  // These drift apart silently: the model would emit an activity the exercise
  // module has never heard of and every such session would fall back to a
  // generic MET value without anyone noticing.
  const described = PARSE_SCHEMA.properties.entries.items.properties.activity.anyOf
    .find((s) => s.type === "string")
    .description.match(/One of: (.+?)\./)[1]
    .split(",")
    .map((s) => s.trim());

  assert.deepEqual(described.sort(), Object.keys(ACTIVITIES).sort());
});

test("the system prompt states the core constraint", () => {
  assert.match(SYSTEM_PROMPT, /extractor, not a calculator/i);
  assert.match(SYSTEM_PROMPT, /Do not compute calories/i);
});
