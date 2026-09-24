import { Clock, ExternalLink, Check, ShoppingBasket } from "lucide-react";
import { CANONICAL_BY_ID } from "../../shared/canonicals.js";
import { describeScale } from "../../shared/scale.js";
import { SOURCE_BY_ID } from "../../worker/crawl/sources.js";

const label = (id) => CANONICAL_BY_ID[id]?.label || id;

export default function RecipeCard({ recipe, servings, compact = false }) {
  const source = SOURCE_BY_ID[recipe.source_id];
  const host = (() => { try { return new URL(recipe.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const pct = Math.round((recipe.coverage ?? 1) * 100);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl">
      <div className={`relative ${compact ? "h-32" : "h-52"} w-full bg-neutral-800`}>
        {recipe.image_url ? (
          <img src={recipe.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-900 via-neutral-900/70 to-transparent px-4 pb-2 pt-10">
          <h3 className={`${compact ? "text-base" : "text-lg"} font-semibold leading-tight text-white`}>{recipe.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-300">
            <span>{source?.name || host}</span>
            {recipe.total_minutes ? <span className="inline-flex items-center gap-1"><Clock size={11} /> {recipe.total_minutes} min</span> : null}
            <span className="tabular">{describeScale(recipe.yield_servings, servings)}</span>
            {recipe.rating ? <span className="tabular">★ {Number(recipe.rating).toFixed(1)}</span> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-neutral-500">
            <span>You have {recipe.matched?.length ?? 0} of {(recipe.matched?.length ?? 0) + (recipe.missing?.length ?? 0)}</span>
            <span className="tabular">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {recipe.missing?.length ? (
          <div>
            <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-400"><ShoppingBasket size={11} /> You'd need</div>
            <div className="flex flex-wrap gap-1">
              {recipe.missing.map((id) => <span key={id} className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">{label(id)}</span>)}
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Everything's on hand</div>
        )}

        {!compact && (
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Uses</div>
            <div className="flex flex-wrap gap-1">
              {(recipe.matched || []).map((id) => <span key={id} className="rounded-md bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">{label(id)}</span>)}
              {(recipe.ingredients || []).filter((i) => i.optional).map((i) => <span key={i.canonical} className="rounded-md border border-dashed border-neutral-700 px-2 py-0.5 text-xs text-neutral-500">{label(i.canonical)} (opt.)</span>)}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {recipe.cuisine && <Tag>{recipe.cuisine}</Tag>}
            {(recipe.diet_tags || []).map((t) => <Tag key={t}>{t}</Tag>)}
            {(recipe.macro_tags || []).map((t) => <Tag key={t} muted={recipe.macro_source === "inferred"}>{t}{recipe.macro_source === "inferred" ? "*" : ""}</Tag>)}
          </div>
          <a
            href={recipe.url} target="_blank" rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800"
          >
            Open recipe <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </article>
  );
}

function Tag({ children, muted }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${muted ? "border-neutral-800 text-neutral-600" : "border-neutral-700 text-neutral-400"}`}>{children}</span>;
}
