// Which model runs the extraction, and what request shape it accepts.
//
// This is a shared table rather than a constant in each place that needs it,
// because the two facts drift apart in exactly the way that produces a runtime
// 400: `effort` is accepted on Opus 5 and Sonnet 5 and rejected outright by
// Haiku 4.5, so "swap the model string" is not sufficient on its own.
//
// Pricing is USD per million tokens, used only by the eval's cost report.
// Sonnet 5 is at introductory pricing ($2/$10) through 2026-08-31.

export const MODELS = {
  "claude-haiku-4-5": { effort: null, maxTokens: 4000, priceIn: 1.0, priceOut: 5.0 },
  "claude-sonnet-5": { effort: "low", maxTokens: 8000, priceIn: 2.0, priceOut: 10.0 },
  "claude-opus-5": { effort: "low", maxTokens: 8000, priceIn: 5.0, priceOut: 25.0 },
};

// Extraction is small, well specified, and schema-constrained, so it starts at
// the cheapest tier. `npm run eval` scores each candidate on a labelled set —
// move up only if the numbers say to.
export const MODEL = "claude-haiku-4-5";

/** Request fields that vary by model, so call sites do not special-case them. */
export function modelRequestOptions(model = MODEL) {
  const spec = MODELS[model] || { effort: null, maxTokens: 8000 };
  return {
    max_tokens: spec.maxTokens,
    // Omitted entirely where unsupported, rather than sent as null.
    ...(spec.effort ? { effort: spec.effort } : {}),
  };
}
