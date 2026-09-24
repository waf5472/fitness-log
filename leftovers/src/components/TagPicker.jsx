import { DIET_TAGS, CUISINE_TAGS, MACRO_TAGS } from "../../shared/tags.js";

function Group({ title, tags, value, onChange, hint }) {
  const set = new Set(value);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11px] uppercase tracking-wide text-neutral-500">{title}</span>
        {hint && <span className="text-[11px] text-neutral-600">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const on = set.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
              className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-emerald-500 bg-emerald-500/15 text-emerald-200" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
              title={t.weak ? "Inferred from ingredients; treat as a hint, not a guarantee" : undefined}
            >
              {t.label}
              {t.weak ? "*" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TagPicker({ diet, cuisine, macro, onChange }) {
  return (
    <div className="space-y-3">
      <Group title="Diet" hint="hard filter" tags={DIET_TAGS} value={diet} onChange={(v) => onChange({ diet: v })} />
      <Group title="Cuisine" hint="boost" tags={CUISINE_TAGS} value={cuisine} onChange={(v) => onChange({ cuisine: v })} />
      <Group title="Macros" hint="boost" tags={MACRO_TAGS} value={macro} onChange={(v) => onChange({ macro: v })} />
    </div>
  );
}
