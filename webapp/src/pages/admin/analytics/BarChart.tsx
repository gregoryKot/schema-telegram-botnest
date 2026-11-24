import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { AdminDailyPoint } from '../../../../../shared/src/analytics/adminAnalytics';
import { fmtDate } from '../../../../../shared/src/utils/format';
import { barHeights, dayReadout, indexFromX, seriesValues, type ChartSeries } from './format';

/** Столбики по дням: день выбирается тапом, наведением или стрелками; по умолчанию — последний. */
export function BarChart({ daily, series }: { daily: AdminDailyPoint[]; series: ChartSeries }) {
  const [picked, setPicked] = useState<number | null>(null);
  const heights = barHeights(seriesValues(daily, series));
  const idx = Math.min(picked ?? daily.length - 1, daily.length - 1);
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = indexFromX(e.clientX, r.left, r.width, daily.length);
    if (i >= 0) setPicked(i);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPicked(Math.max(0, idx - 1));
    else if (e.key === 'ArrowRight') setPicked(Math.min(daily.length - 1, idx + 1));
  };
  return (
    <div>
      <div aria-live="polite" style={{ minHeight: 24, fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {daily[idx] ? dayReadout(daily[idx], series) : '—'}
      </div>
      <div
        role="slider" tabIndex={0} aria-label="День на графике" aria-valuemin={1} aria-valuemax={daily.length}
        aria-valuenow={idx + 1} aria-valuetext={daily[idx] ? dayReadout(daily[idx], series) : ''}
        onPointerMove={pick} onPointerDown={pick} onKeyDown={onKey}
        style={{ display: 'flex', alignItems: 'flex-end', gap: daily.length > 40 ? 1 : 3, height: 140, cursor: 'pointer', touchAction: 'pan-y' }}
      >
        {daily.map((p, i) => (
          <div key={p.date} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{
              width: '100%', height: `${Math.max(heights[i], 2)}%`, borderRadius: '3px 3px 0 0',
              background: i === idx ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 40%, transparent)',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-sub)', marginTop: 6 }}>
        <span>{daily[0] ? fmtDate(daily[0].date) : ''}</span>
        <span>{daily.length ? fmtDate(daily[daily.length - 1].date) : ''}</span>
      </div>
    </div>
  );
}
