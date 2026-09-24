import { Minus, Plus, Search } from "lucide-react";
import IngredientInput from "./IngredientInput.jsx";
import TagPicker from "./TagPicker.jsx";

function Stepper({ label, value, min, max, onChange, suffix }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <span className="text-sm text-neutral-300">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="rounded-lg border border-neutral-700 p-1 text-neutral-300 hover:bg-neutral-800" aria-label={`decrease ${label}`}><Minus size={14} /></button>
        <span className="tabular w-10 text-center text-sm">{value}{suffix}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="rounded-lg border border-neutral-700 p-1 text-neutral-300 hover:bg-neutral-800" aria-label={`increase ${label}`}><Plus size={14} /></button>
      </div>
    </div>
  );
}

export default function QueryForm({ query, onChange, onSubmit, busy, spicerackCount }) {
  const set = (patch) => onChange({ ...query, ...patch });
  const total = query.meals * query.servings;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-neutral-500">What's on hand</label>
        <IngredientInput value={query.have} onChange={(have) => set({ have })} autoFocus />
        <p className="mt-1 text-xs text-neutral-600">
          Plus your {spicerackCount} Spicerack staples, assumed available for every recipe.
        </p>
      </div>

      <TagPicker diet={query.diet} cuisine={query.cuisine} macro={query.macro} onChange={set} />

      <div className="grid gap-2 sm:grid-cols-2">
        <Stepper label="Meals" value={query.meals} min={1} max={6} onChange={(meals) => set({ meals })} />
        <Stepper label="Servings per meal" value={query.servings} min={1} max={12} onChange={(servings) => set({ servings })} />
      </div>
      <p className="-mt-2 text-xs text-neutral-600">
        {query.meals} {query.meals === 1 ? "recipe" : "different recipes"}, each scaled to feed {query.servings} — {total} plates total.
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2.5">
        <input
          type="checkbox"
          checked={query.allowMissing}
          onChange={(e) => set({ allowMissing: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-emerald-500"
        />
        <span className="text-sm">
          <span className="text-neutral-200">May require additional ingredients</span>
          <span className="block text-xs text-neutral-500">
            {query.allowMissing
              ? `On: recipes may need up to ${query.maxMissing} things you don't have. Each card lists exactly what.`
              : "Off: only recipes you can make right now from your list and Spicerack. Expect fewer results."}
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={busy || !query.have.length}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Search size={16} />
        {busy ? "Looking…" : `Find ${query.meals} ${query.meals === 1 ? "meal" : "meals"}`}
      </button>
    </form>
  );
}
