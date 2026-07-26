#!/usr/bin/env node
// Score models on the extraction task this app actually performs.
//
//   npm run eval                          # haiku, sonnet, opus
//   npm run eval -- claude-haiku-4-5      # one model
//   npm run eval -- --verbose             # print every failure
//   npm run eval -- --runs 3              # repeat, to see run-to-run variance
//
// Needs ANTHROPIC_API_KEY (or an `ant auth login` profile). Costs a few cents.

import Anthropic from "@anthropic-ai/sdk";
import { PARSE_SCHEMA, SYSTEM_PROMPT } from "../worker/parse-schema.js";
import { MODELS as CANDIDATES, modelRequestOptions } from "../worker/models.js";
import { CASES } from "./cases.js";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const runsIdx = args.indexOf("--runs");
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 1;
const models = args.filter((a) => a in CANDIDATES);
const targets = models.length ? models : Object.keys(CANDIDATES);

const client = new Anthropic();

async function parseOnce(model, text) {
  const started = Date.now();
  const { max_tokens, ...outputOptions } = modelRequestOptions(model);

  // Deliberately identical to the Worker's call, so the eval measures what
  // production actually does rather than a hand-rolled approximation.
  const res = await client.messages.create({
    model,
    max_tokens,
    system: SYSTEM_PROMPT,
    output_config: {
      ...outputOptions,
      format: { type: "json_schema", schema: PARSE_SCHEMA },
    },
    messages: [
      { role: "user", content: `Today is 2026-07-26.\n\nEntry:\n${text}` },
    ],
  });

  if (res.stop_reason === "refusal") throw new Error("refused");
  if (res.stop_reason === "max_tokens") throw new Error("hit max_tokens");

  const block = res.content.find((b) => b.type === "text");
  if (!block) throw new Error("no text block");

  return {
    parsed: JSON.parse(block.text),
    ms: Date.now() - started,
    usage: res.usage,
  };
}

const results = [];

for (const model of targets) {
  const spec = CANDIDATES[model];
  process.stdout.write(`\n${model}\n`);

  let passed = 0;
  let total = 0;
  let inTok = 0;
  let outTok = 0;
  let ms = 0;
  const failures = [];

  for (let run = 0; run < runs; run++) {
    for (const c of CASES) {
      total++;
      try {
        const { parsed, usage, ms: took } = await parseOnce(model, c.text);
        inTok += usage.input_tokens;
        outTok += usage.output_tokens;
        ms += took;

        const f = c.check(parsed);
        if (f.length === 0) {
          passed++;
          process.stdout.write(".");
        } else {
          process.stdout.write("x");
          failures.push({ id: c.id, text: c.text, reasons: f, got: parsed });
        }
      } catch (err) {
        process.stdout.write("E");
        failures.push({ id: c.id, text: c.text, reasons: [`ERROR: ${err.message}`] });
      }
    }
  }

  const cost = (inTok / 1e6) * spec.priceIn + (outTok / 1e6) * spec.priceOut;
  const perParse = cost / total;

  process.stdout.write(
    `\n  ${passed}/${total} passed` +
      `  ·  ${Math.round(ms / total)} ms/parse` +
      `  ·  $${perParse.toFixed(5)}/parse` +
      `  ·  $${(perParse * 6 * 365).toFixed(2)}/yr at 6 entries/day\n`,
  );

  if (failures.length) {
    const byCase = {};
    for (const f of failures) (byCase[f.id] ||= []).push(f);
    process.stdout.write(`  failed: ${Object.keys(byCase).join(", ")}\n`);
    if (verbose) {
      for (const f of failures) {
        process.stdout.write(`\n  [${f.id}] "${f.text}"\n`);
        for (const r of f.reasons) process.stdout.write(`    - ${r}\n`);
        if (f.got) {
          process.stdout.write(`    got: ${JSON.stringify(f.got.entries, null, 2).slice(0, 900)}\n`);
        }
      }
    }
  }

  results.push({ model, passed, total, perParse, msPerParse: Math.round(ms / total) });
}

process.stdout.write("\n\nsummary\n");
process.stdout.write("  model              pass    ms   $/parse   $/yr\n");
for (const r of results) {
  process.stdout.write(
    `  ${r.model.padEnd(18)} ${String(r.passed).padStart(2)}/${r.total}` +
      `  ${String(r.msPerParse).padStart(4)}` +
      `  ${("$" + r.perParse.toFixed(5)).padStart(8)}` +
      `  ${("$" + (r.perParse * 6 * 365).toFixed(2)).padStart(7)}\n`,
  );
}
process.stdout.write(
  "\nPick the cheapest model that passes everything you care about. Failures on\n" +
    "est_kcal discipline matter most — a model that helpfully computes calories\n" +
    "for ordinary foods routes around the food table and makes results\n" +
    "non-reproducible, which is the whole point of the design.\n",
);
