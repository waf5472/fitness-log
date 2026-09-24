// Chip input with autocomplete over the canonical dictionary. Free text is
// run through the same normalizer the crawler uses, so "2 chicken thighs"
// typed here lands on the same `chicken` the recipes were indexed under.

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { INGREDIENT_OPTIONS, CANONICAL_BY_ID } from "../../shared/canonicals.js";
import { parseIngredient } from "../../shared/normalize.js";

export default function IngredientInput({ value, onChange, placeholder = "chicken thighs, half a bag of spinach, leftover rice…", autoFocus = false }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [unknown, setUnknown] = useState(null);
  const inputRef = useRef(null);
  const selected = new Set(value);

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const starts = [], contains = [];
    for (const o of INGREDIENT_OPTIONS) {
      if (selected.has(o.id)) continue;
      const label = o.label.toLowerCase();
      if (label.startsWith(q)) starts.push(o);
      else if (label.includes(q)) contains.push(o);
      else {
        const syns = CANONICAL_BY_ID[o.id].synonyms;
        if (syns.some((s) => s.startsWith(q))) contains.push(o);
      }
    }
    return [...starts, ...contains].slice(0, 8);
  }, [text, value]);

  const add = (id) => {
    if (!id || selected.has(id)) return;
    onChange([...value, id]);
    setText("");
    setActive(0);
    setUnknown(null);
  };

  // Free text may hold several items: "eggs, spinach and some rice".
  const commitText = () => {
    const parts = text.split(/,|;|\band\b|\n/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const found = [], missed = [];
    for (const p of parts) {
      const { canonical } = parseIngredient(p);
      if (canonical) found.push(canonical);
      else missed.push(p);
    }
    if (found.length) onChange([...value, ...found.filter((f) => !selected.has(f))]);
    setText(missed.join(", "));
    setUnknown(missed.length ? missed : null);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      if (!text.trim()) return;
      e.preventDefault();
      if (suggestions.length && !text.includes(",") && !/\band\b/.test(text)) add(suggestions[active].id);
      else commitText();
    } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
  };

  return (
    <div>
      <div
        className="flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 focus-within:border-neutral-600"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-900/40 px-2 py-1 text-xs text-emerald-200">
            {CANONICAL_BY_ID[id]?.label || id}
            <button type="button" aria-label={`remove ${id}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== id)); }} className="text-emerald-400 hover:text-white">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => { setText(e.target.value); setActive(0); setUnknown(null); }}
          onKeyDown={onKey}
          onBlur={() => text.trim() && commitText()}
          placeholder={value.length ? "add more…" : placeholder}
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-neutral-600"
          autoComplete="off" autoCapitalize="off" spellCheck={false}
        />
      </div>
      {suggestions.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 text-sm shadow-lg">
          {suggestions.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left ${i === active ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-800/60"}`}
              >
                <span>{o.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">{o.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {unknown && (
        <p className="mt-1 text-xs text-amber-400">
          Didn't recognize: {unknown.join(", ")}. Try a plainer word (the index knows “chicken”, not brands or cuts).
        </p>
      )}
    </div>
  );
}
