// Owner-only crawler console. Small on purpose: the heavy lifting is
// scripts/crawl.mjs from a laptop; this is for nudging the cron and for
// teaching the dictionary new words.

import { useEffect, useState } from "react";
import { admin } from "../lib/api.js";
import { INGREDIENT_OPTIONS } from "../../shared/canonicals.js";

export default function AdminView() {
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const refresh = () => admin("status").then(setStatus).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); }, []);

  const run = async (label, path, body) => {
    setBusy(true); setErr(null);
    try {
      const r = await admin(path, body || {});
      setLog((l) => [{ at: new Date().toLocaleTimeString(), label, r }, ...l].slice(0, 12));
      await refresh();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!status) return <p className="text-sm text-neutral-500">{err || "Loading…"}</p>;
  const t = status.totals || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Recipes" value={t.recipes || 0} />
        <Stat label="Partially parsed" value={t.partial || 0} />
        <Stat label="Queued" value={status.queue?.n || 0} sub={`${status.queue?.failed || 0} failed`} />
        <Stat label="Dead links" value={t.dead || 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => run("sitemaps", "sitemaps")} disabled={busy}>Refresh 2 stale sitemaps</Btn>
        <Btn onClick={() => run("crawl", "crawl", { batch: 10 })} disabled={busy}>Crawl 10 now</Btn>
        <Btn onClick={() => run("resolve", "resolve", { limit: 60 })} disabled={busy}>Resolve 60 phrases (Haiku)</Btn>
        <Btn onClick={() => run("renormalize", "renormalize", { limit: 200 })} disabled={busy}>Re-parse 200 partial recipes</Btn>
      </div>
      {err && <p className="text-xs text-rose-400">{err}</p>}

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Sources</h3>
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900 text-neutral-500"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Recipes</th><th className="px-3 py-2 text-right">Queued</th><th className="px-3 py-2">Sitemap read</th><th className="px-3 py-2">Last error</th></tr></thead>
            <tbody>
              {status.sources.map((s) => (
                <tr key={s.id} className="border-t border-neutral-800/70">
                  <td className="px-3 py-1.5 text-neutral-200">{s.name}{s.robots_ok ? "" : " (robots: no)"}</td>
                  <td className="tabular px-3 py-1.5 text-right">{s.recipe_count}</td>
                  <td className="tabular px-3 py-1.5 text-right">{s.queued}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{s.sitemap_at ? s.sitemap_at.slice(0, 10) : "never"}</td>
                  <td className="max-w-[16rem] truncate px-3 py-1.5 text-rose-400/80">{s.last_error || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Unresolved phrases (most common first)</h3>
        {status.unresolved.length === 0 ? <p className="text-xs text-neutral-600">Nothing pending.</p> : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {status.unresolved.map((u) => <Unresolved key={u.phrase} u={u} onSave={(canonical) => run(`synonym ${u.phrase}`, "synonym", { phrase: u.phrase, canonical })} />)}
          </ul>
        )}
      </section>

      {log.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">Recent runs</h3>
          <pre className="max-h-64 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-[11px] text-neutral-400">{log.map((l) => `${l.at} ${l.label}\n${JSON.stringify(l.r, null, 1)}\n`).join("\n")}</pre>
        </section>
      )}
    </div>
  );
}

function Unresolved({ u, onSave }) {
  const [val, setVal] = useState("");
  return (
    <li className="flex items-center gap-2 rounded-lg border border-neutral-800 px-2 py-1.5 text-xs">
      <span className="tabular w-8 text-right text-neutral-500">{u.count}</span>
      <span className="min-w-0 flex-1 truncate text-neutral-200" title={u.phrase}>{u.phrase}</span>
      <select value={val} onChange={(e) => setVal(e.target.value)} className="max-w-[9rem] rounded-md bg-neutral-900 px-1 py-0.5 text-[11px] text-neutral-300">
        <option value="">map to…</option>
        <option value="__ignore__">ignore (not an ingredient)</option>
        {INGREDIENT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button type="button" disabled={!val} onClick={() => onSave(val === "__ignore__" ? null : val)} className="rounded-md border border-neutral-700 px-2 py-0.5 text-[11px] disabled:opacity-40">Save</button>
    </li>
  );
}

const Stat = ({ label, value, sub }) => (
  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
    <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
    <div className="tabular text-xl text-neutral-100">{value}</div>
    {sub && <div className="text-[11px] text-neutral-600">{sub}</div>}
  </div>
);
const Btn = (p) => <button type="button" {...p} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40" />;
