import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bookmark, Settings, Cloud, HardDrive } from "lucide-react";
import LogView from "./components/LogView.jsx";
import TrendsView from "./components/TrendsView.jsx";
import SavedView from "./components/SavedView.jsx";
import ProfileView from "./components/ProfileView.jsx";
import { detectMode, createStore } from "./lib/store.js";
import { computeMeal } from "./lib/nutrition.js";
import { computeExercise } from "./lib/exercise.js";
import { DEFAULT_PROFILE, todayISO, shiftDate, loggingStreak } from "./lib/goals.js";

const TABS = [
  { id: "log", label: "Log", icon: Activity },
  { id: "trends", label: "Trends", icon: BarChart3 },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "profile", label: "Profile", icon: Settings },
];

export default function App() {
  const [session, setSession] = useState(null); // {mode, email}
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState("log");
  const [date, setDate] = useState(todayISO());

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [entries, setEntries] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [drafts, setDrafts] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);

  // Decide which backend to use once, then never branch on it again.
  useEffect(() => {
    detectMode().then((s) => {
      setSession(s);
      setStore(createStore(s.mode));
    });
  }, []);

  useEffect(() => {
    if (!store) return;
    store.getProfile().then(setProfile);
    store.listTemplates().then(setTemplates);
  }, [store]);

  const refresh = useCallback(async () => {
    if (!store) return;
    const [day, week] = await Promise.all([
      store.listEntries(date, date),
      store.listEntries(shiftDate(date, -6), date),
    ]);
    setEntries(day);
    setWeekEntries(week);
  }, [store, date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const streak = useMemo(() => {
    const byDate = {};
    for (const e of weekEntries) (byDate[e.date] ||= []).push(e);
    return loggingStreak(byDate, todayISO());
  }, [weekEntries]);

  // --- parse -> editable drafts ---------------------------------------------
  const handleParse = async (text) => {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, today: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not parse that entry.");
      if (!data.entries?.length) throw new Error("Nothing recognizable in that entry.");

      setDrafts(data.entries.map((e) => toDraft(e, date, text)));
      if (data.note) setError(data.note);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  // --- save -----------------------------------------------------------------
  const handleSave = async () => {
    for (const draft of drafts) {
      await store.addEntry(finalize(draft, profile));
    }
    setDrafts([]);
    setError(null);
    await refresh();
  };

  const handleDelete = async (id) => {
    await store.deleteEntry(id);
    await refresh();
  };

  const handleSaveTemplate = async (computed, draft) => {
    const template = {
      id: crypto.randomUUID(),
      kind: draft.kind,
      name: draft.name,
      payload:
        draft.kind === "meal"
          ? { ...computed, ingredients: draft.ingredients }
          : {
              activity: draft.activity,
              distance_mi: draft.distance_mi,
              duration_min: draft.duration_min,
              elev_ft: draft.elev_ft,
            },
    };
    await store.saveTemplate(template);
    setTemplates(await store.listTemplates());
  };

  // Re-logging a favorite recomputes it rather than copying old numbers, so a
  // saved workout picks up your current body weight automatically.
  const handleLogTemplate = async (template) => {
    const today = todayISO();
    const record =
      template.kind === "meal"
        ? computeMeal({
            name: template.name,
            slot: template.payload.slot,
            ingredients: template.payload.ingredients,
          })
        : computeExercise({ ...template.payload, name: template.name }, profile.weight_lb);

    await store.addEntry({
      id: crypto.randomUUID(),
      date: today,
      created_at: new Date().toISOString(),
      raw_text: null,
      ...record,
    });
    setDate(today);
    setTab("log");
    await refresh();
  };

  const handleSaveProfile = async (next) => {
    await store.saveProfile(next);
    setProfile(next);
  };

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Fitness Log</h1>
          <p className="text-xs text-neutral-500">
            Say what you ate or did. The math is not the model's job.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="flex items-center gap-1.5 rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500"
            title={
              session?.mode === "cloud"
                ? `Synced to your account (${session.email})`
                : "Stored in this browser only"
            }
          >
            {session?.mode === "cloud" ? <Cloud size={11} /> : <HardDrive size={11} />}
            {session?.mode === "cloud" ? "synced" : "local"}
          </span>
          {streak > 1 && <span className="text-[10px] text-neutral-600">{streak} day streak</span>}
        </div>
      </header>

      {session?.mode === "local" && (
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
          You're in the public demo, pre-filled with three months of sample data. Everything you log
          stays in this browser — nothing is stored on a server. Export from the Profile tab to keep it.
        </div>
      )}

      <nav className="mb-6 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
              tab === t.id
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "log" && (
        <LogView
          date={date}
          setDate={setDate}
          entries={entries}
          weekEntries={weekEntries}
          profile={profile}
          drafts={drafts}
          setDrafts={setDrafts}
          onParse={handleParse}
          onSave={handleSave}
          onSaveTemplate={handleSaveTemplate}
          onDelete={handleDelete}
          parsing={parsing}
          error={error}
        />
      )}
      {tab === "trends" && <TrendsView store={store} profile={profile} />}
      {tab === "saved" && (
        <SavedView
          templates={templates}
          onLog={handleLogTemplate}
          onDelete={async (id) => {
            await store.deleteTemplate(id);
            setTemplates(await store.listTemplates());
          }}
        />
      )}
      {tab === "profile" && (
        <ProfileView
          profile={profile}
          onSave={handleSaveProfile}
          store={store}
          mode={session?.mode}
          email={session?.email}
        />
      )}

      <footer className="mt-16 border-t border-neutral-800 pt-4 text-[11px] text-neutral-600">
        Calories from a USDA-derived food table; exercise from the ACSM metabolic equations and the
        Compendium of Physical Activities. Estimates, not measurements — useful for trends, not for
        clinical decisions.
      </footer>
    </div>
  );
}

/** Model output -> an editable draft, with the date offset already applied. */
function toDraft(entry, baseDate, rawText) {
  return {
    key: crypto.randomUUID(),
    kind: entry.kind,
    name: entry.name || "Entry",
    date: shiftDate(baseDate, entry.date_offset || 0),
    slot: entry.slot,
    ingredients: entry.ingredients || [],
    activity: entry.activity || "other",
    distance_mi: entry.distance_mi,
    duration_min: entry.duration_min,
    elev_ft: entry.elev_ft,
    weight_lb: entry.weight_lb,
    raw_text: rawText,
  };
}

/** Draft -> the record that gets persisted. Numbers are computed here, once. */
function finalize(draft, profile) {
  const base = {
    id: crypto.randomUUID(),
    date: draft.date,
    created_at: new Date().toISOString(),
    raw_text: draft.raw_text,
  };

  if (draft.kind === "meal") {
    return {
      ...base,
      ...computeMeal({ name: draft.name, slot: draft.slot, ingredients: draft.ingredients }),
      detail: draft.ingredients,
    };
  }
  if (draft.kind === "exercise") {
    return { ...base, ...computeExercise(draft, profile.weight_lb) };
  }
  return {
    ...base,
    kind: "weight",
    name: draft.name || "Weigh-in",
    weight_lb: Number(draft.weight_lb) || 0,
  };
}
