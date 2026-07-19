// ── Sparkline components for therapist cabinet ──────────────────────────────
// Единственная копия (правило №3 CLAUDE.md) — используется webapp (реэкспорт
// в webapp/src/components/therapist/Sparklines.tsx) и schema-miniapp напрямую.

/** Mini sparkline for the client roster (96×30) */
export function RosterSparkline({ values }: { values: (number | null)[] }) {
  const W = 96,
    H = 30,
    N = 14;
  const pts = values.slice(-N);
  const nums = pts.filter((v) => v != null);
  if (nums.length < 2) return <svg width={W} height={H} />;
  const min = Math.min(...nums),
    max = Math.max(...nums);
  const range = max - min || 1;
  const step = W / Math.max(N - 1, 1);
  const x = (i: number) => i * step;
  const y = (v: number) => H - 4 - ((v - min) / range) * (H - 8);
  const d = pts
    .map((v, i) =>
      v == null
        ? null
        : `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(' ');
  const last = nums[nums.length - 1];
  // --accent-yellow/--accent-red определены в обоих фронтендах (в webapp —
  // алиасы --c-amber/--c-rose), поэтому общий компонент использует их.
  const color =
    last >= 7
      ? '#06d6a0'
      : last >= 4
        ? 'var(--accent-yellow)'
        : 'var(--accent-red)';
  const lastIdx =
    pts
      .map((v, i) => (v != null ? i : -1))
      .filter((i) => i >= 0)
      .pop() ?? -1;
  const lastPt =
    lastIdx >= 0 && pts[lastIdx] != null
      ? { cx: x(lastIdx), cy: y(pts[lastIdx]) }
      : null;
  return (
    <svg width={W} height={H} className="spark">
      {d && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {lastPt && <circle cx={lastPt.cx} cy={lastPt.cy} r={2.5} fill={color} />}
    </svg>
  );
}

/** Larger sparkline for client detail sidebar (180×48) */
export function ClientSparkline({
  values,
  color,
}: {
  values: (number | null)[];
  color: string;
}) {
  const pts = values
    .map((v, i) => (v !== null ? { x: i, y: v } : null))
    .filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return null;
  const W = 180,
    H = 48;
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const range = maxY - minY || 1;
  const n = values.length - 1 || 1;
  const d = pts
    .map((p) => `${(p.x / n) * W},${H - ((p.y - minY) / range) * (H - 8) - 4}`)
    .join(' ');
  return (
    <svg
      width={W}
      height={H}
      style={{ overflow: 'visible', display: 'block', marginTop: 8 }}
    >
      <polyline
        points={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.6}
      />
      <circle
        cx={(pts[pts.length - 1].x / n) * W}
        cy={H - ((pts[pts.length - 1].y - minY) / range) * (H - 8) - 4}
        r={3}
        fill={color}
        opacity={0.9}
      />
    </svg>
  );
}
