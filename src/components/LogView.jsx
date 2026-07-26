// The thin part. One box, one button, one day at a time.

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Trash2, Utensils, Activity, Scale } from "lucide-react";
import { Ring, MacroBar, VolumeBar } from "./Charts.jsx";
import ParsePreview from "./ParsePreview.jsx";
import { dailyTargets, summarizeDay, weeklyVolume, shiftDate, todayISO } from "../lib/goals.js";
import { formatPace } from "../lib/exercise.js";

const EXAMPLES = [
  "parfait with 6oz raspberries, 1 cup Greek yogurt, 1 tsp chia seeds",
  "hiked 6.2mi in 2h10m, 1400ft gain",
  "stir fry with 1 chicken breast, 1 bell pepper, 1 onion, 1/4 cup kung pao sauce, 1 tsp oil",
  "kayaked 4 miles in an hour and 15",
  "weighed in at 176.2",
];

export default function LogView({
  date, setDate, entries, weekEntries, profile,
  drafts, setDrafts, onParse, onSave, onSaveTemplate, onDelete, parsing, error,
}) {
  const [text, setText] = useState("");

  const summary = summarizeDay(entries);
  const targets = dailyTargets(profile, summary.burned);
  const volume = weeklyVolume(weekEntries, profile.targets);

  const submit = (e) => {
    e?.preventDefault();
    if (!text.trim() || parsing) return;
    onParse(text.trim());
    setText("");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
            rows={2}
            placeholder="What did you eat or do? Plain English is fine."
            className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 pr-28 text-[15px] outline-none transition placeholder:text-neutral-600 focus:border-neutral-700"
          />
          <button
            type="submit"
            disabled={!text.trim() || parsing}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition disabled:opacity-30"
          >
            {parsing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {parsing ? "Reading" : "Log"}
          </button>
        </div>

        {!drafts.length && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-full border border-neutral-800 px-2.5 py-1 text-[11px] text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
              >
                {ex.length > 46 ? `${ex.slice(0, 46)}…` : ex}
              </button>
            ))}
          </div>
        )}
      </form>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <ParsePreview
        drafts={drafts}
        setDrafts={setDrafts}
        profile={profile}
        onSave={onSave}
        onSaveTemplate={onSaveTemplate}
        onCancel={() => setDrafts([])}
      />

      {/* --- the day --- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="rounded p-1 text-neutral-500 transition hover:bg-neutral-900 hover:text-neutral-200"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="tabular min-w-[9rem] text-center text-sm text-neutral-300">
            {formatDay(date)}
          </span>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= todayISO()}
            className="rounded p-1 text-neutral-500 transition hover:bg-neutral-900 hover:text-neutral-200 disabled:opacity-20"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {date !== todayISO() && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-xs text-neutral-500 transition hover:text-neutral-300"
          >
            today
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Ring value={summary.eaten} target={targets.kcal} label="Calories" color="#f59e0b" />
        <Ring value={summary.protein_g} target={targets.protein_g} label="Protein" unit="g" color="#38bdf8" />
        <Ring value={summary.carb_g} target={targets.carb_g} label="Carbs" unit="g" color="#a78bfa" />
        <Ring value={summary.fat_g} target={targets.fat_g} label="Fat" unit="g" color="#fb7185" />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="mb-3 grid grid-cols-3 gap-3 text-center">
          <Stat label="Eaten" value={summary.eaten} />
          <Stat label="Burned" value={summary.burned} accent="text-emerald-400" />
          <Stat label="Net" value={summary.net} />
        </div>
        <MacroBar {...summary} />
        <p className="mt-3 text-[11px] text-neutral-600">
          Target {targets.kcal} kcal = {targets.base_tdee} base
          {targets.exercise_kcal > 0 && ` + ${targets.exercise_kcal} exercise`}
          {targets.adjustment !== 0 && ` ${targets.adjustment > 0 ? "+" : "−"} ${Math.abs(targets.adjustment)} goal`}
        </p>
      </div>

      {volume.length > 0 && (
        <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <h3 className="text-xs uppercase tracking-wide text-neutral-500">This week's volume</h3>
          {volume.map((v) => (
            <VolumeBar
              key={`${v.activity}-${v.metric}`}
              label={`${cap(v.activity)} ${METRIC_LABEL[v.metric] || v.metric}`}
              actual={v.actual}
              target={v.target}
              unit={METRIC_UNIT[v.metric] || ""}
              pct={v.pct}
            />
          ))}
        </div>
      )}

      <div className="space-y-1">
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-600">Nothing logged for this day.</p>
        )}
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} onDelete={() => onDelete(e.id)} />
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry, onDelete }) {
  const Icon = entry.kind === "meal" ? Utensils : entry.kind === "exercise" ? Activity : Scale;
  const [open, setOpen] = useState(false);
  const hasDetail = entry.kind === "meal" && entry.ingredients?.length;

  return (
    <div className="group rounded-lg border border-transparent px-3 py-2 transition hover:border-neutral-800 hover:bg-neutral-900/40">
      <div className="flex items-center gap-3">
        <Icon size={14} className="shrink-0 text-neutral-600" />
        <button
          onClick={() => hasDetail && setOpen(!open)}
          className={`flex-1 text-left text-sm ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
        >
          {entry.name}
          {entry.slot && <span className="ml-2 text-xs text-neutral-600">{entry.slot}</span>}
        </button>

        <span className="tabular text-xs text-neutral-500">
          {entry.kind === "exercise" && entry.duration_min && `${Math.round(entry.duration_min)} min`}
          {entry.kind === "exercise" && entry.distance_mi ? ` · ${entry.distance_mi} mi` : ""}
          {entry.kind === "exercise" && entry.pace_min_per_mi ? ` · ${formatPace(entry.pace_min_per_mi)}` : ""}
          {entry.kind === "weight" && `${entry.weight_lb} lb`}
        </span>

        {entry.kind !== "weight" && (
          <span
            className={`tabular w-14 text-right text-sm ${
              entry.kind === "exercise" ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {entry.kind === "exercise" ? "−" : ""}
            {Math.round(entry.kcal || 0)}
          </span>
        )}

        <button
          onClick={onDelete}
          className="text-neutral-700 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open && hasDetail && (
        <ul className="ml-7 mt-2 space-y-0.5 border-l border-neutral-800 pl-3">
          {entry.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between text-[11px] text-neutral-500">
              <span>
                {ing.qty} {ing.unit} {ing.name}
                {ing.grams ? <span className="ml-1.5 text-neutral-700">{ing.grams}g</span> : null}
              </span>
              <span className="tabular">{ing.kcal}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, accent = "text-neutral-100" }) {
  return (
    <div>
      <div className={`tabular text-2xl font-semibold ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

const METRIC_LABEL = { distance_mi: "distance", duration_min: "time", elev_ft: "gain" };
const METRIC_UNIT = { distance_mi: "mi", duration_min: "min", elev_ft: "ft" };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function formatDay(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (iso === todayISO()) return "Today";
  if (iso === shiftDate(todayISO(), -1)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
