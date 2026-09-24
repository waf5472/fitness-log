// The swipe deck. Hand-rolled on pointer events: no dependency, ~80 lines,
// works with touch, mouse, arrow keys, and the two buttons for anyone who
// cannot or would rather not drag. Right = Cookbook, left = never again.

import { useEffect, useRef, useState } from "react";
import { Heart, X, RefreshCw } from "lucide-react";
import RecipeCard from "./RecipeCard.jsx";

const THRESHOLD = 110; // px of horizontal travel that counts as a decision

export default function Deck({ cards, servings, onSwipe, onRerun, busy }) {
  const top = cards[0];
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState(null); // 'left' | 'right'
  const startRef = useRef(null);

  const decide = (dir) => {
    if (!top || leaving) return;
    setLeaving(dir);
    setTimeout(() => {
      setLeaving(null);
      setDrag({ x: 0, y: 0, active: false });
      onSwipe(top, dir);
    }, 220);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight") decide("right");
      if (e.key === "ArrowLeft") decide("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y, active: true });
  };
  const onPointerUp = () => {
    if (!startRef.current) return;
    const dx = drag.x;
    startRef.current = null;
    if (Math.abs(dx) > THRESHOLD) decide(dx > 0 ? "right" : "left");
    else setDrag({ x: 0, y: 0, active: false });
  };

  if (!top) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 p-10 text-center">
        <p className="text-sm text-neutral-400">Nothing left in this hand.</p>
        <button type="button" onClick={onRerun} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40">
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Deal again
        </button>
      </div>
    );
  }

  const x = leaving ? (leaving === "right" ? 600 : -600) : drag.x;
  const rot = Math.max(-18, Math.min(18, x / 12));
  const opinion = Math.abs(x) > 40 ? (x > 0 ? "right" : "left") : null;

  return (
    <div>
      <div className="relative mx-auto h-[34rem] max-w-md select-none">
        {cards.slice(1, 3).reverse().map((c, i, arr) => {
          const depth = arr.length - i; // 1 = just under the top card
          return (
            <div key={c.id} className="absolute inset-0" style={{ transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`, opacity: 1 - depth * 0.25 }}>
              <RecipeCard recipe={c} servings={servings} />
            </div>
          );
        })}
        <div
          key={top.id}
          className="swipe-surface absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{
            transform: `translate(${x}px, ${drag.y * 0.2}px) rotate(${rot}deg)`,
            transition: drag.active && !leaving ? "none" : "transform 220ms ease-out",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <RecipeCard recipe={top} servings={servings} />
          {opinion && (
            <div className={`pointer-events-none absolute top-6 ${opinion === "right" ? "left-6 -rotate-12 border-emerald-400 text-emerald-300" : "right-6 rotate-12 border-rose-400 text-rose-300"} rounded-lg border-4 px-3 py-1 text-2xl font-black uppercase tracking-widest`}>
              {opinion === "right" ? "Cook" : "Nope"}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-6">
        <button type="button" onClick={() => decide("left")} aria-label="Pass (never show again)" className="rounded-full border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300 transition hover:bg-rose-500/20">
          <X size={22} />
        </button>
        <button type="button" onClick={onRerun} disabled={busy} aria-label="Rerun: replace the cards you have not swiped" className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40">
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Rerun
        </button>
        <button type="button" onClick={() => decide("right")} aria-label="Save to Cookbook" className="rounded-full border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 transition hover:bg-emerald-500/20">
          <Heart size={22} />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-neutral-600">
        Swipe or use ← → · {cards.length} in hand · Rerun swaps only the ones you haven't decided on
      </p>
    </div>
  );
}
