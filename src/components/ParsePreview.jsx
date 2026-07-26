// The editable card between "what you typed" and "what gets saved".
//
// This is the part that makes trusting an LLM with your log reasonable: the
// model's extraction is a draft, every field is editable, and the numbers
// recompute locally on each keystroke. A bad parse is a two-second fix rather
// than a corrupted record you discover a month later.

import { useMemo, useState } from "react";
import { Check, Plus, Trash2, X, AlertTriangle, Bookmark } from "lucide-react";
import { computeMeal, searchFoods } from "../lib/nutrition.js";
import { computeExercise, ACTIVITIES, formatPace } from "../lib/exercise.js";

export default function ParsePreview({ drafts, setDrafts, profile, onSave, onSaveTemplate, onCancel }) {
  if (!drafts?.length) return null;

  return (
    <div className="space-y-3">
      {drafts.map((draft, i) => (
        <DraftCard
          key={draft.key}
          draft={draft}
          profile={profile}
          onChange={(next) => setDrafts(drafts.map((d, j) => (j === i ? next : d)))}
          onRemove={() => setDrafts(drafts.filter((_, j) => j !== i))}
          onSaveTemplate={onSaveTemplate}
        />
      ))}

      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          <Check size={16} />
          Save {drafts.length > 1 ? `${drafts.length} entries` : "entry"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function DraftCard({ draft, profile, onChange, onRemove, onSaveTemplate }) {
  // Recomputed from the edited fields on every render — the displayed number is
  // always the number that will be saved.
  const computed = useMemo(() => {
    if (draft.kind === "meal") {
      return computeMeal({ name: draft.name, slot: draft.slot, ingredients: draft.ingredients });
    }
    if (draft.kind === "exercise") {
      return computeExercise(draft, profile.weight_lb);
    }
    return { kind: "weight", name: draft.name, weight_lb: Number(draft.weight_lb) || 0, warnings: [] };
  }, [draft, profile.weight_lb]);

  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full bg-transparent text-base font-medium outline-none focus:text-white"
          />
          <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 capitalize">{draft.kind}</span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
              className="bg-transparent text-neutral-500 outline-none [color-scheme:dark]"
            />
            {draft.kind === "meal" && (
              <select
                value={draft.slot || ""}
                onChange={(e) => set({ slot: e.target.value || null })}
                className="bg-transparent capitalize text-neutral-500 outline-none"
              >
                <option value="">no slot</option>
                {["breakfast", "lunch", "dinner", "snack"].map((s) => (
                  <option key={s} value={s} className="bg-neutral-900">
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            title="Save as a reusable favorite"
            onClick={() => onSaveTemplate(computed, draft)}
            className="rounded p-1.5 text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
          >
            <Bookmark size={15} />
          </button>
          <button
            onClick={onRemove}
            className="rounded p-1.5 text-neutral-600 transition hover:bg-neutral-800 hover:text-red-400"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {draft.kind === "meal" && (
        <MealEditor draft={draft} computed={computed} set={set} />
      )}
      {draft.kind === "exercise" && (
        <ExerciseEditor draft={draft} computed={computed} set={set} />
      )}
      {draft.kind === "weight" && (
        <div className="flex items-center gap-2">
          <NumField
            label="Weight"
            value={draft.weight_lb}
            onChange={(v) => set({ weight_lb: v })}
            suffix="lb"
          />
        </div>
      )}

      <Warnings items={computed.warnings} />
    </div>
  );
}

function MealEditor({ draft, computed, set }) {
  const update = (i, patch) =>
    set({ ingredients: draft.ingredients.map((ing, j) => (j === i ? { ...ing, ...patch } : ing)) });

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {draft.ingredients.map((ing, i) => (
          <IngredientRow
            key={i}
            ing={ing}
            resolved={computed.ingredients[i]}
            onChange={(patch) => update(i, patch)}
            onRemove={() => set({ ingredients: draft.ingredients.filter((_, j) => j !== i) })}
          />
        ))}
      </div>

      <button
        onClick={() =>
          set({ ingredients: [...draft.ingredients, { name: "", qty: 1, unit: "each" }] })
        }
        className="flex items-center gap-1 text-xs text-neutral-500 transition hover:text-neutral-300"
      >
        <Plus size={13} /> add ingredient
      </button>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-neutral-800 pt-3">
        <span className="tabular text-xl font-semibold text-amber-400">{computed.kcal}</span>
        <span className="text-xs text-neutral-500">kcal</span>
        <Macro label="P" value={computed.protein_g} color="text-sky-400" />
        <Macro label="C" value={computed.carb_g} color="text-violet-400" />
        <Macro label="F" value={computed.fat_g} color="text-rose-400" />
        <ConfidenceBadge level={computed.confidence} />
      </div>
    </div>
  );
}

function IngredientRow({ ing, resolved, onChange, onRemove }) {
  const [focused, setFocused] = useState(false);
  const suggestions = focused && ing.name ? searchFoods(ing.name, 5) : [];
  const estimated = resolved?.source === "estimated" || resolved?.source === "unknown";

  return (
    <div className="group relative flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-neutral-800/40">
      <input
        type="text"
        value={ing.qty}
        onChange={(e) => onChange({ qty: e.target.value })}
        className="tabular w-12 rounded bg-neutral-800/60 px-1.5 py-0.5 text-right outline-none focus:bg-neutral-800"
      />
      <input
        type="text"
        value={ing.unit}
        onChange={(e) => onChange({ unit: e.target.value })}
        className="w-16 rounded bg-neutral-800/60 px-1.5 py-0.5 text-xs text-neutral-400 outline-none focus:bg-neutral-800"
      />
      <div className="relative flex-1">
        <input
          type="text"
          value={ing.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="w-full bg-transparent outline-none"
          placeholder="ingredient"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
            {suggestions.map((f) => (
              <button
                key={f.id}
                onMouseDown={() => onChange({ name: f.name })}
                className="block w-full px-3 py-1.5 text-left text-xs text-neutral-300 transition hover:bg-neutral-800"
              >
                {f.name}
                <span className="ml-2 text-neutral-600">{f.per100g.kcal} kcal/100g</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="tabular w-14 text-right text-xs text-neutral-500">
        {resolved?.grams ? `${resolved.grams}g` : "—"}
      </span>
      <span
        className={`tabular w-14 text-right text-xs ${estimated ? "text-amber-500" : "text-neutral-400"}`}
        title={estimated ? "Estimated — not in the food table" : resolved?.basis}
      >
        {resolved?.kcal ?? 0}
      </span>
      <button
        onClick={onRemove}
        className="text-neutral-700 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ExerciseEditor({ draft, computed, set }) {
  const spec = ACTIVITIES[draft.activity] || ACTIVITIES.other;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">Activity</span>
          <select
            value={draft.activity || "other"}
            onChange={(e) => set({ activity: e.target.value })}
            className="rounded bg-neutral-800/60 px-2 py-1 text-sm outline-none"
          >
            {Object.entries(ACTIVITIES).map(([key, a]) => (
              <option key={key} value={key} className="bg-neutral-900">
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <NumField
          label="Distance"
          value={draft.distance_mi}
          onChange={(v) => set({ distance_mi: v })}
          suffix="mi"
        />
        <NumField
          label="Duration"
          value={draft.duration_min}
          onChange={(v) => set({ duration_min: v })}
          suffix="min"
        />
        <NumField
          label="Elev gain"
          value={draft.elev_ft}
          onChange={(v) => set({ elev_ft: v })}
          suffix="ft"
        />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-neutral-800 pt-3">
        <span className="tabular text-xl font-semibold text-emerald-400">{computed.kcal}</span>
        <span className="text-xs text-neutral-500">kcal net</span>
        {computed.pace_min_per_mi && (
          <span className="tabular text-xs text-neutral-400">{formatPace(computed.pace_min_per_mi)}</span>
        )}
        {computed.grade_pct && (
          <span className="tabular text-xs text-neutral-400">{computed.grade_pct}% grade</span>
        )}
        {computed.met && <span className="tabular text-xs text-neutral-400">{computed.met} MET</span>}
      </div>
      <p className="text-[11px] text-neutral-600">{computed.method}</p>
    </div>
  );
}

function NumField({ label, value, onChange, suffix }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="flex items-center gap-1 rounded bg-neutral-800/60 px-2 py-1">
        <input
          type="number"
          step="any"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="tabular w-16 bg-transparent text-sm outline-none"
        />
        <span className="text-[10px] text-neutral-500">{suffix}</span>
      </span>
    </label>
  );
}

function Macro({ label, value, color }) {
  return (
    <span className="text-xs">
      <span className={`tabular font-medium ${color}`}>{value}</span>
      <span className="ml-0.5 text-neutral-600">g {label}</span>
    </span>
  );
}

function ConfidenceBadge({ level }) {
  if (level === "exact") return null;
  const copy =
    level === "estimated"
      ? "contains estimates"
      : "fuzzy match";
  return (
    <span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">
      {copy}
    </span>
  );
}

function Warnings({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-neutral-800 pt-2">
      {items.map((w, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-500">
          <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-600" />
          {w}
        </li>
      ))}
    </ul>
  );
}
