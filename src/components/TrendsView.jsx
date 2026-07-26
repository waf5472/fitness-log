import { useEffect, useState } from "react";
import { BarChart, TrendChart, VolumeBar } from "./Charts.jsx";
import {
  dailyTargets, weightTrend, predictedVsActual, hitCalorieGoal,
  weeklyVolume, shiftDate, todayISO,
} from "../lib/goals.js";

const WINDOWS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export default function TrendsView({ store, profile }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [exercise, setExercise] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const to = todayISO();
    const from = shiftDate(to, -(days - 1));

    Promise.all([store.summarize(from, to), store.listEntries(from, to)])
      .then(([summaries, entries]) => {
        if (cancelled) return;
        setRows(fillGaps(summaries, from, to));
        setExercise(entries.filter((e) => e.kind === "exercise"));
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [store, days]);

  if (loading) {
    return <p className="py-16 text-center text-sm text-neutral-600">Loading…</p>;
  }

  const logged = rows.filter((r) => r.mealCount > 0);
  const avgEaten = avg(logged.map((r) => r.eaten));
  const avgBurned = avg(rows.map((r) => r.burned));
  const avgProtein = avg(logged.map((r) => r.protein_g));
  const targets = dailyTargets(profile, Math.round(avgBurned));

  const hits = logged.filter((r) =>
    hitCalorieGoal(r, dailyTargets(profile, r.burned), profile),
  ).length;

  const trend = weightTrend(
    rows.filter((r) => r.weight_lb != null).map((r) => ({ date: r.date, weight_lb: r.weight_lb })),
  );
  const reality = predictedVsActual(
    rows.map((r) => ({ date: r.date, summary: r })),
    profile,
  );

  const volume = weeklyVolume(exercise, profile.targets);

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setDays(w.days)}
            className={`rounded-lg px-3 py-1 text-xs transition ${
              days === w.days
                ? "bg-neutral-100 text-neutral-900"
                : "border border-neutral-800 text-neutral-400 hover:bg-neutral-900"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Avg eaten" value={Math.round(avgEaten)} unit="kcal" />
        <Tile label="Avg burned" value={Math.round(avgBurned)} unit="kcal" accent="text-emerald-400" />
        <Tile label="Avg protein" value={Math.round(avgProtein)} unit="g" accent="text-sky-400" />
        <Tile
          label="On target"
          value={logged.length ? Math.round((hits / logged.length) * 100) : 0}
          unit="%"
        />
      </div>

      <Panel title="Calories in" subtitle={`dashed line = ${targets.kcal} kcal target`}>
        <BarChart
          data={rows.map((r) => ({
            date: r.date,
            value: r.eaten,
            over: r.mealCount > 0 && r.eaten > dailyTargets(profile, r.burned).kcal,
          }))}
          target={targets.kcal}
          color="#f59e0b"
        />
      </Panel>

      <Panel title="Calories out" subtitle="net exercise expenditure per day">
        <BarChart data={rows.map((r) => ({ date: r.date, value: r.burned }))} color="#34d399" />
      </Panel>

      <Panel title="Protein" subtitle={`dashed line = ${targets.protein_g} g target`}>
        <BarChart
          data={rows.map((r) => ({ date: r.date, value: r.protein_g }))}
          target={targets.protein_g}
          color="#38bdf8"
        />
      </Panel>

      <Panel title="Weight" subtitle="dots are scale readings, line is the smoothed trend">
        <TrendChart points={trend} />
        {reality && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-800 pt-3 text-sm">
            <div>
              <div className="tabular text-neutral-300">
                {fmtSigned(reality.predicted_rate_lb_wk)} lb/wk
              </div>
              <div className="text-[11px] text-neutral-500">predicted by your log</div>
            </div>
            <div>
              <div className="tabular text-neutral-300">
                {fmtSigned(reality.actual_rate_lb_wk)} lb/wk
              </div>
              <div className="text-[11px] text-neutral-500">measured on the scale</div>
            </div>
            <p className="col-span-2 text-[11px] leading-relaxed text-neutral-600">
              {gapNote(reality)}
            </p>
          </div>
        )}
      </Panel>

      {volume.length > 0 && (
        <Panel title="Training volume" subtitle={`across the last ${days} days`}>
          <div className="space-y-3">
            {volume.map((v) => (
              <VolumeBar
                key={`${v.activity}-${v.metric}`}
                label={`${cap(v.activity)} ${METRIC_LABEL[v.metric] || v.metric}`}
                actual={v.actual}
                target={Math.round(v.target * (days / 7))}
                unit={METRIC_UNIT[v.metric] || ""}
                pct={v.actual / (v.target * (days / 7))}
              />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="By activity" subtitle={`sessions in the last ${days} days`}>
        <ActivityBreakdown entries={exercise} />
      </Panel>
    </div>
  );
}

function ActivityBreakdown({ entries }) {
  const byActivity = {};
  for (const e of entries) {
    const key = e.activity || "other";
    byActivity[key] ||= { sessions: 0, kcal: 0, minutes: 0, miles: 0 };
    byActivity[key].sessions++;
    byActivity[key].kcal += e.kcal || 0;
    byActivity[key].minutes += e.duration_min || 0;
    byActivity[key].miles += e.distance_mi || 0;
  }

  const rows = Object.entries(byActivity).sort((a, b) => b[1].kcal - a[1].kcal);
  if (!rows.length) return <p className="text-xs text-neutral-600">No sessions logged.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-neutral-600">
          <th className="pb-2 text-left font-normal">Activity</th>
          <th className="pb-2 text-right font-normal">Sessions</th>
          <th className="pb-2 text-right font-normal">Time</th>
          <th className="pb-2 text-right font-normal">Distance</th>
          <th className="pb-2 text-right font-normal">kcal</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.map(([activity, s]) => (
          <tr key={activity} className="border-t border-neutral-800/60">
            <td className="py-1.5 text-left capitalize text-neutral-300">{activity}</td>
            <td className="py-1.5 text-right text-neutral-400">{s.sessions}</td>
            <td className="py-1.5 text-right text-neutral-400">{Math.round(s.minutes)}m</td>
            <td className="py-1.5 text-right text-neutral-400">
              {s.miles ? `${s.miles.toFixed(1)}mi` : "—"}
            </td>
            <td className="py-1.5 text-right text-emerald-400">{Math.round(s.kcal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <header className="mb-3">
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
        {subtitle && <p className="text-[11px] text-neutral-600">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Tile({ label, value, unit, accent = "text-neutral-100" }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className={`tabular text-xl font-semibold ${accent}`}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-neutral-600">{unit}</span>
      </div>
      <div className="text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

/** Days with nothing logged still need a slot on the chart, or gaps read as zeros. */
function fillGaps(summaries, from, to) {
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const out = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) {
    out.push(
      byDate.get(d) || {
        date: d, eaten: 0, burned: 0, net: 0,
        protein_g: 0, carb_g: 0, fat_g: 0,
        mealCount: 0, exerciseCount: 0, weight_lb: null,
      },
    );
  }
  return out;
}

function gapNote(r) {
  const gap = r.actual_rate_lb_wk - r.predicted_rate_lb_wk;
  if (Math.abs(gap) < 0.25) {
    return `Over ${r.days} days your logged intake predicted this closely — the estimates are calibrated.`;
  }
  return gap > 0
    ? `The scale is moving ${Math.abs(gap).toFixed(1)} lb/wk higher than your log predicts, which usually means intake is being under-recorded rather than metabolism being unusual.`
    : `The scale is moving ${Math.abs(gap).toFixed(1)} lb/wk lower than your log predicts — either exercise is under-counted or maintenance is higher than the formula assumes.`;
}

const METRIC_LABEL = { distance_mi: "distance", duration_min: "time", elev_ft: "gain" };
const METRIC_UNIT = { distance_mi: "mi", duration_min: "min", elev_ft: "ft" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtSigned = (n) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
