// The one place a language model touches the pipeline: mapping ingredient
// phrases the dictionary missed onto canonical ids. Runs in batches at admin
// or cron time, never per user query, and every answer is written down as a
// synonym override so the same phrase is never asked about twice.
//
// Haiku first (per the model table); the eval for moving up is the accept
// rate on the admin review page, not vibes.

import Anthropic from "@anthropic-ai/sdk";
import { CANONICALS } from "../../shared/canonicals.js";
import { MODEL, modelRequestOptions } from "../models.js";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mappings"],
  properties: {
    mappings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phrase", "canonical", "confidence"],
        properties: {
          phrase: { type: "string" },
          canonical: { type: ["string", "null"], description: "An id from the list, or null if the phrase is not a food ingredient or is a cooking instruction / equipment / heading." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

const SYSTEM = `You map messy recipe ingredient phrases to a fixed dictionary of canonical ingredient ids.
Rules:
- Choose the canonical whose real-world identity matches. "boneless skinless chicken breasts" -> chicken. "AP flour" -> flour.
- Prefer the most specific id available (smoked-paprika over paprika, coconut-milk over milk, green-onion over onion).
- If the phrase is not an ingredient (a section heading like "for the sauce", equipment, "water" already covered as water, a full instruction), return null.
- If no id fits and the phrase IS a real ingredient, return null with confidence "low" so a human can add it.
- Never invent ids. Only use ids from the list.`;

export async function resolveUnresolved(db, env, { limit = 60 } = {}) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the Worker");
  const { results } = await db.prepare("SELECT phrase, count FROM unresolved ORDER BY count DESC LIMIT ?").bind(limit).all();
  if (!results.length) return { asked: 0, mapped: 0, ignored: 0, deferred: 0 };

  const dictionary = CANONICALS.map((c) => `${c.id}${c.label !== c.id ? ` (${c.label})` : ""} [${c.category}]`).join("\n");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { max_tokens, ...outputOptions } = modelRequestOptions();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens,
    system: SYSTEM,
    output_config: { ...outputOptions, format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Canonical ids:\n${dictionary}\n\nPhrases to map (one per line):\n${results.map((r) => r.phrase).join("\n")}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("model refused the batch");
  const block = response.content.find((b) => b.type === "text");
  const parsed = JSON.parse(block?.text || "{}");
  const valid = new Set(CANONICALS.map((c) => c.id));
  const now = new Date().toISOString();
  const stmts = [];
  const report = { asked: results.length, mapped: 0, ignored: 0, deferred: 0, usage: response.usage };
  for (const m of parsed.mappings || []) {
    const phrase = String(m.phrase || "").trim();
    if (!phrase) continue;
    if (m.canonical && !valid.has(m.canonical)) { report.deferred++; continue; }
    if (m.confidence === "low") { report.deferred++; continue; }
    stmts.push(
      db.prepare("INSERT OR REPLACE INTO synonym_overrides (phrase, canonical, source, created_at) VALUES (?, ?, 'llm', ?)").bind(phrase, m.canonical, now),
      db.prepare("DELETE FROM unresolved WHERE phrase = ?").bind(phrase),
    );
    if (m.canonical) report.mapped++; else report.ignored++;
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return report;
}
