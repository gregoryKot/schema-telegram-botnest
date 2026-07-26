// Спарклайн-график экрана «Сегодня». Вынесено из TodaySection.tsx (правило №10).

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div style={{ height: 40 }} />;
  const min = 0;
  const max = 10;
  const W = 240, H = 40;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / (max - min)) * (H - 6) - 3,
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', height: 40 }}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
