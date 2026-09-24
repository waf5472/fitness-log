import { useState } from "react";
import { Trash2, ExternalLink, ChefHat, Search } from "lucide-react";
import { CANONICAL_BY_ID } from "../../shared/canonicals.js";
import { describeScale } from "../../shared/scale.js";

export default function CookbookView({ items, servings, onRemove, onCooked, onNotes }) {
  const [q, setQ] = useState("");
  const shown = items.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()) || (c.matched || []).some((id) => (CANONICAL_BY_ID[id]?.label || id).includes(q.toLowerCase())));

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center">
        <p className="text-sm text-neutral-500">Your Cookbook is empty.</p>
        <p className="mt-1 text-xs text-neutral-600">Swipe right on a recipe (or press →) and it lands here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
        <Search size={14} className="text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search saved recipes or an ingredient" className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600" />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((c) => (
          <div key={c.id} className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
              {c.image_url && <img src={c.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-neutral-100">{c.title}</div>
              <div className="tabular text-[11px] text-neutral-500">
                {describeScale(c.yield_servings, servings)}
                {c.total_minutes ? ` · ${c.total_minutes} min` : ""}
                {c.cooked_count ? ` · cooked ${c.cooked_count}×` : ""}
              </div>
              {c.missing?.length ? (
                <div className="mt-1 truncate text-[11px] text-amber-400">needed: {c.missing.map((id) => CANONICAL_BY_ID[id]?.label || id).join(", ")}</div>
              ) : null}
              <textarea
                defaultValue={c.notes || ""}
                onBlur={(e) => e.target.value !== (c.notes || "") && onNotes(c.id, e.target.value)}
                placeholder="notes…"
                rows={1}
                className="mt-1 w-full resize-none rounded-md bg-neutral-950/60 px-2 py-1 text-xs text-neutral-300 outline-none placeholder:text-neutral-700 focus:ring-1 focus:ring-neutral-700"
              />
              <div className="mt-1.5 flex items-center gap-1">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-800">Open <ExternalLink size={10} /></a>
                <button type="button" onClick={() => onCooked(c.id)} className="inline-flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800" title="I cooked this"><ChefHat size={11} /> Cooked it</button>
                <button type="button" onClick={() => onRemove(c.id)} className="ml-auto rounded-md p-1 text-neutral-600 hover:text-rose-400" aria-label="remove"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
