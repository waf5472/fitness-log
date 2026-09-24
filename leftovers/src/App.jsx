import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Utensils, BookHeart, FlaskConical, Cloud, HardDrive, Wrench } from "lucide-react";
import QueryForm from "./components/QueryForm.jsx";
import Deck from "./components/Deck.jsx";
import CookbookView from "./components/CookbookView.jsx";
import SpicerackView from "./components/SpicerackView.jsx";
import AdminView from "./components/AdminView.jsx";
import { detectMode, createStore } from "./lib/store.js";
import { matchRecipes, fetchStats } from "./lib/api.js";

const DEFAULT_QUERY = { have: [], diet: [], cuisine: [], macro: [], meals: 3, servings: 4, allowMissing: true, maxMissing: 3 };

const TABS = [
  { id: "find", label: "Find", icon: Utensils },
  { id: "cookbook", label: "Cookbook", icon: BookHeart },
  { id: "spicerack", label: "Spicerack", icon: FlaskConical },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState("find");
  const [stats, setStats] = useState(null);

  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [spicerack, setSpicerack] = useState([]);
  const [cookbook, setCookbook] = useState([]);
  const [swipes, setSwipes] = useState({ left: [], right: [] });

  const [hand, setHand] = useState([]);       // cards currently dealt, top first
  const seenRef = useRef(new Set());          // every id dealt this session
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dealt, setDealt] = useState(false);

  useEffect(() => {
    detectMode().then((s) => { setSession(s); setStore(createStore(s.mode)); });
    fetchStats().then(setStats);
  }, []);

  useEffect(() => {
    if (!store) return;
    store.getSpicerack().then(setSpicerack);
    store.listCookbook().then(setCookbook);
    store.getSwipes().then(setSwipes);
    store.getPrefs().then((p) => p?.query && setQuery({ ...DEFAULT_QUERY, ...p.query, have: p.query.have || [] }));
  }, [store]);

  const excludeIds = useMemo(
    () => [...new Set([...swipes.left, ...swipes.right, ...cookbook.map((c) => c.id), ...seenRef.current])],
    [swipes, cookbook, hand],
  );

  // Deal `count` fresh cards. Used by the first search (full hand) and by
  // Rerun (only the slots the user has not decided on).
  const deal = useCallback(async (count, replaceIds = []) => {
    if (!query.have.length) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await matchRecipes({
        have: query.have, spicerack, diet: query.diet, cuisine: query.cuisine, macro: query.macro,
        allowMissing: query.allowMissing, maxMissing: query.maxMissing, count,
        exclude: [...excludeIds, ...replaceIds],
      });
      for (const r of res.recipes) seenRef.current.add(r.id);
      setHand((h) => [...h.filter((c) => !replaceIds.includes(c.id)), ...res.recipes]);
      setDealt(true);
      if (res.degraded) setNotice("Nothing matched with everything on hand, so these need a thing or two. The toggle is still off; each card says exactly what's missing.");
      else if (!res.recipes.length) setNotice(res.poolSize === 0 && !stats?.recipes ? "The recipe index is empty. Run the crawler first (see README)." : "No more matches for this list. Try fewer tags, add an ingredient, or allow extra ingredients.");
      else if (res.recipes.length < count) setNotice(`Only ${res.recipes.length} ${res.recipes.length === 1 ? "recipe" : "recipes"} fit. Loosen the tags or add an ingredient for more.`);
      store?.setPrefs({ query });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [query, spicerack, excludeIds, store, stats]);

  const onSearch = () => {
    seenRef.current = new Set();
    setHand([]);
    // A new search starts from a clean hand but keeps permanent left-swipes.
    setTimeout(() => deal(query.meals), 0);
  };
  const onRerun = () => deal(hand.length ? hand.length : query.meals, hand.map((c) => c.id));

  const onSwipe = async (card, dir) => {
    setHand((h) => h.filter((c) => c.id !== card.id));
    if (dir === "right") {
      const saved = { ...card, servings: query.servings };
      setCookbook((cb) => [saved, ...cb.filter((c) => c.id !== card.id)]);
      setSwipes((s) => ({ ...s, right: [...s.right, card.id] }));
      await store.saveToCookbook(saved);
    } else {
      setSwipes((s) => ({ ...s, left: [...s.left, card.id] }));
      await store.addSwipe(card.id, "left");
    }
  };

  // When the hand empties, deal a fresh one automatically (like any deck app),
  // but only if the user has actually searched.
  useEffect(() => {
    if (dealt && !busy && hand.length === 0 && query.have.length && tab === "find") {
      const t = setTimeout(() => deal(query.meals), 350);
      return () => clearTimeout(t);
    }
  }, [hand.length, dealt, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSpicerack = async (ids) => { setSpicerack(ids); await store.setSpicerack(ids); };
  const removeFromCookbook = async (id) => { setCookbook((cb) => cb.filter((c) => c.id !== id)); setSwipes((s) => ({ ...s, right: s.right.filter((x) => x !== id) })); await store.removeFromCookbook(id); };
  const cooked = async (id) => {
    const item = cookbook.find((c) => c.id === id);
    const n = (item?.cooked_count || 0) + 1;
    setCookbook((cb) => cb.map((c) => (c.id === id ? { ...c, cooked_count: n } : c)));
    await store.updateCookbook(id, { cooked_count: n });
  };
  const notes = async (id, text) => { setCookbook((cb) => cb.map((c) => (c.id === id ? { ...c, notes: text } : c))); await store.updateCookbook(id, { notes: text }); };
  const forgetLefts = async () => { setSwipes((s) => ({ ...s, left: [] })); await store.clearLeftSwipes(); };

  if (!session || !store) return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  const isOwner = session.mode === "cloud";
  const tabs = isOwner ? [...TABS, { id: "admin", label: "Crawler", icon: Wrench }] : TABS;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-24 pt-6 sm:pb-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leftovers</h1>
          <p className="text-sm text-neutral-500">What's in the fridge → {query.meals} things you can cook.</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1">{isOwner ? <Cloud size={12} /> : <HardDrive size={12} />}{isOwner ? session.email : "saved in this browser"}</span>
          {stats?.recipes ? <span className="tabular">{stats.recipes.toLocaleString()} recipes · {stats.sources} sites</span> : null}
          {!session.apiUp && <span className="text-amber-500">API offline — run <code>npm run dev:api</code></span>}
        </div>
      </header>

      <nav className="mb-5 hidden gap-1 rounded-xl border border-neutral-800 bg-neutral-900/40 p-1 sm:flex">
        {tabs.map((t) => <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} badge={t.id === "cookbook" ? cookbook.length : null} />)}
      </nav>

      <main>
        {tab === "find" && (
          <div className="space-y-6">
            {!dealt || hand.length === 0 && !busy ? (
              <QueryForm query={query} onChange={setQuery} onSubmit={onSearch} busy={busy} spicerackCount={spicerack.length} />
            ) : (
              <details className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <summary className="cursor-pointer text-sm text-neutral-300">
                  {query.have.length} ingredients · {[...query.diet, ...query.cuisine, ...query.macro].join(", ") || "no tags"} · {query.meals}×{query.servings} · <span className="text-neutral-500">edit</span>
                </summary>
                <div className="pt-3"><QueryForm query={query} onChange={setQuery} onSubmit={onSearch} busy={busy} spicerackCount={spicerack.length} /></div>
              </details>
            )}
            {error && <p className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>}
            {notice && <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">{notice}</p>}
            {dealt && (busy && !hand.length ? <p className="text-center text-sm text-neutral-500">Dealing…</p> : <Deck cards={hand} servings={query.servings} onSwipe={onSwipe} onRerun={onRerun} busy={busy} />)}
            {swipes.left.length > 0 && (
              <p className="text-center text-[11px] text-neutral-600">
                {swipes.left.length} recipes hidden for good after a left swipe. <button type="button" onClick={forgetLefts} className="underline hover:text-neutral-400">Forget them</button>
              </p>
            )}
          </div>
        )}
        {tab === "cookbook" && <CookbookView items={cookbook} servings={query.servings} onRemove={removeFromCookbook} onCooked={cooked} onNotes={notes} />}
        {tab === "spicerack" && <SpicerackView items={spicerack} onChange={updateSpicerack} />}
        {tab === "admin" && isOwner && <AdminView />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-800 bg-neutral-950/95 backdrop-blur sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map((t) => <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} badge={t.id === "cookbook" ? cookbook.length : null} mobile />)}
      </nav>

      <footer className="mt-10 text-center text-[11px] text-neutral-700">
        Recipes stay on the sites that wrote them. Leftovers indexes ingredient lists and links out.
      </footer>
    </div>
  );
}

function TabButton({ t, active, onClick, badge, mobile }) {
  const Icon = t.icon;
  return (
    <button type="button" onClick={onClick} className={`${mobile ? "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]" : "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm"} transition ${active ? (mobile ? "text-emerald-300" : "bg-neutral-800 text-white") : "text-neutral-500 hover:text-neutral-300"}`}>
      <Icon size={mobile ? 18 : 15} />
      <span>{t.label}{badge ? <span className="tabular ml-1 text-neutral-500">{badge}</span> : null}</span>
    </button>
  );
}
