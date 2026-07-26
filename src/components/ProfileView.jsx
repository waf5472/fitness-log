import { useState } from "react";
import { Download, Upload, Check } from "lucide-react";
import { ACTIVITY_FACTORS, bmr, baseTdee, dailyTargets } from "../lib/goals.js";
import { ACTIVITIES } from "../lib/exercise.js";

export default function ProfileView({ profile, onSave, store, mode, email }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const set = (patch) => {
    setDraft({ ...draft, ...patch });
    setSaved(false);
  };

  const targets = dailyTargets(draft, 0);

  const save = async () => {
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const doExport = async () => {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitness-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file) => {
    try {
      const payload = JSON.parse(await file.text());
      const res = await store.importAll(payload);
      setImportMsg(`Imported ${res.imported ?? payload.entries?.length ?? 0} entries. Reload to see them.`);
    } catch (err) {
      setImportMsg(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Body">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Sex">
            <select
              value={draft.sex}
              onChange={(e) => set({ sex: e.target.value })}
              className="w-full bg-transparent outline-none"
            >
              {["male", "female", "other"].map((s) => (
                <option key={s} value={s} className="bg-neutral-900">
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Num label="Age" value={draft.age} onChange={(v) => set({ age: v })} />
          <Num label="Height" value={draft.height_in} onChange={(v) => set({ height_in: v })} suffix="in" />
          <Num label="Weight" value={draft.weight_lb} onChange={(v) => set({ weight_lb: v })} suffix="lb" />
        </div>

        <Field label="Daily activity, not counting workouts">
          <select
            value={draft.activity_factor}
            onChange={(e) => set({ activity_factor: Number(e.target.value) })}
            className="w-full bg-transparent outline-none"
          >
            {ACTIVITY_FACTORS.map((f) => (
              <option key={f.value} value={f.value} className="bg-neutral-900">
                {f.label} (×{f.value})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] leading-relaxed text-neutral-600">
          Exercise you log is added to your target on top of this, so pick the option that
          describes your day <em>without</em> training. Choosing a workout-inclusive multiplier
          here would count every session twice.
        </p>
      </Section>

      <Section title="Goals">
        <Field label="Rate of change">
          <select
            value={draft.goal_rate_lb_wk}
            onChange={(e) => set({ goal_rate_lb_wk: Number(e.target.value) })}
            className="w-full bg-transparent outline-none"
          >
            {[-2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 1].map((r) => (
              <option key={r} value={r} className="bg-neutral-900">
                {r === 0 ? "Maintain" : `${r > 0 ? "Gain" : "Lose"} ${Math.abs(r)} lb/week`}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Num
            label="Protein"
            value={draft.protein_g_per_lb}
            step={0.05}
            onChange={(v) => set({ protein_g_per_lb: v })}
            suffix="g per lb"
          />
          <Num
            label="Fat share of remaining calories"
            value={Math.round((draft.fat_pct ?? 0.3) * 100)}
            onChange={(v) => set({ fat_pct: v / 100 })}
            suffix="%"
          />
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm">
          <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
            <Readout label="BMR" value={bmr(draft)} unit="kcal" />
            <Readout label="Base burn" value={baseTdee(draft)} unit="kcal" />
            <Readout label="Target" value={targets.kcal} unit="kcal" />
            <Readout label="Protein" value={targets.protein_g} unit="g" />
          </div>
          <p className="mt-2 text-[11px] text-neutral-600">
            Target shown for a rest day. Every calorie you log from exercise raises it.
          </p>
        </div>
      </Section>

      <Section title="Weekly training targets">
        <VolumeTargets targets={draft.targets || {}} onChange={(t) => set({ targets: t })} />
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          {saved ? <Check size={16} /> : null}
          {saved ? "Saved" : "Save profile"}
        </button>
      </div>

      <Section title="Your data">
        <p className="text-[11px] leading-relaxed text-neutral-500">
          {mode === "cloud" ? (
            <>
              Signed in as <span className="text-neutral-300">{email}</span>. Entries are stored
              server-side in D1 and sync across your devices.
            </>
          ) : (
            <>
              This log lives in <span className="text-neutral-300">this browser only</span> — nothing
              is sent to a server except the sentences you ask the model to parse. Clearing site data
              will erase it, so export anything you want to keep.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={doExport}
            className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-900"
          >
            <Download size={13} /> Export JSON
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-900">
            <Upload size={13} /> Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </label>
        </div>
        {importMsg && <p className="text-xs text-neutral-400">{importMsg}</p>}
      </Section>
    </div>
  );
}

function VolumeTargets({ targets, onChange }) {
  const [adding, setAdding] = useState("");
  const rows = Object.entries(targets);

  const setMetric = (activity, metric, value) => {
    const next = { ...targets, [activity]: { ...targets[activity] } };
    if (!value) delete next[activity][metric];
    else next[activity][metric] = value;
    if (Object.keys(next[activity]).length === 0) delete next[activity];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-xs text-neutral-600">
          No weekly targets set. Add one to track training volume alongside calories.
        </p>
      )}

      {rows.map(([activity, metrics]) => (
        <div key={activity} className="rounded-lg border border-neutral-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm capitalize text-neutral-200">
              {ACTIVITIES[activity]?.label || activity}
            </span>
            <button
              onClick={() => {
                const next = { ...targets };
                delete next[activity];
                onChange(next);
              }}
              className="text-[11px] text-neutral-600 hover:text-red-400"
            >
              remove
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["distance_mi", "duration_min", "elev_ft"].map((metric) => (
              <Num
                key={metric}
                label={LABEL[metric]}
                value={metrics[metric] ?? ""}
                onChange={(v) => setMetric(activity, metric, v)}
                suffix={UNIT[metric]}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <select
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-800 bg-transparent px-3 py-1.5 text-xs outline-none"
        >
          <option value="">Add an activity…</option>
          {Object.entries(ACTIVITIES)
            .filter(([k]) => !targets[k])
            .map(([k, a]) => (
              <option key={k} value={k} className="bg-neutral-900">
                {a.label}
              </option>
            ))}
        </select>
        <button
          disabled={!adding}
          onClick={() => {
            onChange({ ...targets, [adding]: { duration_min: 60 } });
            setAdding("");
          }}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-900 disabled:opacity-30"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="block rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-1.5 text-sm">
        {children}
      </span>
    </label>
  );
}

function Num({ label, value, onChange, suffix, step = 1 }) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="tabular w-full bg-transparent outline-none"
        />
        {suffix && <span className="shrink-0 text-[10px] text-neutral-500">{suffix}</span>}
      </span>
    </Field>
  );
}

function Readout({ label, value, unit }) {
  return (
    <div>
      <div className="tabular text-lg font-semibold text-neutral-100">
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-neutral-600">{unit}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

const LABEL = { distance_mi: "Distance", duration_min: "Time", elev_ft: "Elevation" };
const UNIT = { distance_mi: "mi", duration_min: "min", elev_ft: "ft" };
