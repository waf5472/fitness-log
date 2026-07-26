// Hand-rolled SVG charts. Four small chart types did not justify a charting
// dependency, and inlining them keeps the bundle honest.

const PALETTE = {
  kcal: "#f59e0b",
  protein: "#38bdf8",
  carb: "#a78bfa",
  fat: "#fb7185",
  burn: "#34d399",
  weight: "#e2e8f0",
  grid: "#27272a",
  axis: "#52525b",
};

/** Progress ring. `pct` may exceed 1; the overflow is drawn in a warning hue. */
export function Ring({ value, target, label, unit = "", color = PALETTE.kcal, size = 92 }) {
  const pct = target > 0 ? value / target : 0;
  const clamped = Math.min(pct, 1);
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const over = pct > 1.02;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE.grid} strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "#ef4444" : color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="-mt-[62px] mb-[38px] text-center leading-tight">
        <div className="tabular text-lg font-semibold">{Math.round(value)}</div>
        <div className="text-[10px] text-neutral-500">
          / {Math.round(target)}
          {unit}
        </div>
      </div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}

/** Daily bars with a target line drawn through them. */
export function BarChart({ data, target, height = 150, color = PALETTE.kcal }) {
  if (!data.length) return <Empty height={height} />;

  const max = Math.max(...data.map((d) => d.value), target || 0) * 1.1 || 1;
  const w = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {target > 0 && (
        <line
          x1="0"
          x2="100"
          y1={height - (target / max) * height}
          y2={height - (target / max) * height}
          stroke={PALETTE.axis}
          strokeWidth="0.5"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {data.map((d, i) => {
        const h = (d.value / max) * height;
        return (
          <rect
            key={d.date || i}
            x={i * w + w * 0.15}
            y={height - h}
            width={w * 0.7}
            height={Math.max(h, 0)}
            fill={d.over ? "#ef4444" : color}
            opacity={d.value ? 0.85 : 0.15}
            rx="0.6"
          >
            <title>{`${d.date}: ${Math.round(d.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Scatter of raw values with a smoothed trend line over the top. */
export function TrendChart({ points, height = 170 }) {
  const valid = points.filter((p) => p.weight_lb != null);
  if (valid.length < 2) return <Empty height={height} label="Log at least two weigh-ins" />;

  const values = valid.flatMap((p) => [p.weight_lb, p.trend_lb]);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const span = max - min || 1;

  const x = (i) => (i / (valid.length - 1)) * 100;
  const y = (v) => height - ((v - min) / span) * height;

  const trendPath = valid.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.trend_lb)}`).join(" ");

  return (
    <div className="relative">
      {/* The line is drawn in a stretched viewBox so it spans the container.
          The dots are positioned elements rather than SVG circles: the same
          stretch would squash a circle into a horizontal dash. */}
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d={trendPath}
            fill="none"
            stroke={PALETTE.weight}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
        {valid.map((p, i) => (
          <span
            key={p.date}
            title={`${p.date}: ${p.weight_lb} lb`}
            className="absolute h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-600"
            style={{ left: `${x(i)}%`, top: y(p.weight_lb) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
        <span>{valid[0].date}</span>
        <span className="tabular">
          {min.toFixed(0)}–{max.toFixed(0)} lb
        </span>
        <span>{valid[valid.length - 1].date}</span>
      </div>
    </div>
  );
}

/** Horizontal progress bar, used for weekly training volume. */
export function VolumeBar({ label, actual, target, unit, pct }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-neutral-300">{label}</span>
        <span className="tabular text-neutral-500">
          {actual} / {target} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(pct, 1) * 100}%`,
            background: pct >= 1 ? PALETTE.burn : PALETTE.kcal,
          }}
        />
      </div>
    </div>
  );
}

/** Stacked macro composition for a single day. */
export function MacroBar({ protein_g, carb_g, fat_g }) {
  const kcal = { p: protein_g * 4, c: carb_g * 4, f: fat_g * 9 };
  const total = kcal.p + kcal.c + kcal.f;
  if (!total) return null;

  const seg = [
    { key: "Protein", v: kcal.p, color: PALETTE.protein },
    { key: "Carbs", v: kcal.c, color: PALETTE.carb },
    { key: "Fat", v: kcal.f, color: PALETTE.fat },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {seg.map((s) => (
          <div key={s.key} style={{ width: `${(s.v / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex gap-4 text-[11px] text-neutral-500">
        {seg.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.key} {Math.round((s.v / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Empty({ height, label = "No data yet" }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-neutral-800 text-xs text-neutral-600"
      style={{ height }}
    >
      {label}
    </div>
  );
}

export { PALETTE };
