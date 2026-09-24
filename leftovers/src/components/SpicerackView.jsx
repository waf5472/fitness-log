// The staples every recipe may assume you have. Anything checked here counts
// as "on hand" in every query, so keeping it honest matters more than keeping
// it long: unchecking things you are out of is the whole point.

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { CANONICALS, DEFAULT_SPICERACK } from "../../shared/canonicals.js";
import IngredientInput from "./IngredientInput.jsx";

const CATEGORY_ORDER = ["spice", "herb", "oil", "condiment", "baking", "sweetener", "dairy", "vegetable", "fruit", "grain", "pasta", "bread", "legume", "nut", "beverage", "egg", "meat", "poultry", "fish", "shellfish", "other"];
const CATEGORY_LABEL = { spice: "Spices", herb: "Herbs", oil: "Oils", condiment: "Condiments & sauces", baking: "Baking", sweetener: "Sweeteners", dairy: "Dairy", vegetable: "Vegetables", fruit: "Fruit", grain: "Grains", pasta: "Pasta & noodles", bread: "Bread", legume: "Legumes", nut: "Nuts & seeds", beverage: "Liquids", egg: "Eggs", meat: "Meat", poultry: "Poultry", fish: "Fish", shellfish: "Shellfish", other: "Other" };

export default function SpicerackView({ items, onChange }) {
  const set = new Set(items);
  const groups = useMemo(() => {
    const byCat = new Map();
    // Show defaults plus anything the user added, grouped; hide the long tail.
    const visible = CANONICALS.filter((c) => c.staple || set.has(c.id));
    for (const c of visible) {
      if (!byCat.has(c.category)) byCat.set(c.category, []);
      byCat.get(c.category).push(c);
    }
    return CATEGORY_ORDER.filter((k) => byCat.has(k)).map((k) => [k, byCat.get(k).sort((a, b) => a.label.localeCompare(b.label))]);
  }, [items]);

  const toggle = (id) => onChange(set.has(id) ? items.filter((x) => x !== id) : [...items, id]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-400">
          Checked items are assumed on hand for every search. <span className="tabular text-neutral-200">{items.length}</span> staples.
        </p>
        <button type="button" onClick={() => onChange([...DEFAULT_SPICERACK])} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800">
          <RotateCcw size={12} /> Reset to defaults
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-neutral-500">Add a staple</label>
        <IngredientInput value={[]} onChange={(ids) => onChange([...new Set([...items, ...ids])])} placeholder="fish sauce, tahini, capers…" />
      </div>

      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">{CATEGORY_LABEL[cat] || cat}</h3>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {list.map((c) => {
              const on = set.has(c.id);
              return (
                <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${on ? "border-emerald-700/60 bg-emerald-900/20 text-emerald-100" : "border-neutral-800 text-neutral-500 hover:border-neutral-700"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="h-3.5 w-3.5 accent-emerald-500" />
                  <span className="truncate">{c.label}</span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
