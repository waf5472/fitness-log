// Saved meals and workouts. The point is one-tap re-logging: most people eat
// the same twelve breakfasts, and retyping them into an LLM every morning would
// be a worse experience than the food-database tapping this replaces.

import { Trash2, Plus, Utensils, Activity } from "lucide-react";

export default function SavedView({ templates, onLog, onDelete }) {
  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center">
        <p className="text-sm text-neutral-500">No favorites saved yet.</p>
        <p className="mt-1 text-xs text-neutral-600">
          Log something, then press the bookmark icon on the preview card to keep it.
        </p>
      </div>
    );
  }

  const meals = templates.filter((t) => t.kind === "meal");
  const workouts = templates.filter((t) => t.kind === "exercise");

  return (
    <div className="space-y-6">
      {meals.length > 0 && (
        <Group title="Meals" icon={Utensils} items={meals} onLog={onLog} onDelete={onDelete} />
      )}
      {workouts.length > 0 && (
        <Group title="Workouts" icon={Activity} items={workouts} onLog={onLog} onDelete={onDelete} />
      )}
    </div>
  );
}

function Group({ title, icon: Icon, items, onLog, onDelete }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
        <Icon size={13} /> {title}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="group flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 transition hover:border-neutral-700"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-neutral-200">{t.name}</div>
              <div className="tabular text-[11px] text-neutral-500">
                {t.kind === "meal" ? (
                  <>
                    {Math.round(t.payload.kcal)} kcal · {Math.round(t.payload.protein_g)}g protein
                    {t.payload.ingredients?.length ? ` · ${t.payload.ingredients.length} ingredients` : ""}
                  </>
                ) : (
                  <>
                    {t.payload.duration_min} min
                    {t.payload.distance_mi ? ` · ${t.payload.distance_mi} mi` : ""}
                    {t.payload.elev_ft ? ` · ${t.payload.elev_ft} ft` : ""}
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => onLog(t)}
              title="Log this today"
              className="flex items-center gap-1 rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700"
            >
              <Plus size={13} /> Log
            </button>
            <button
              onClick={() => onDelete(t.id)}
              className="text-neutral-700 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
