import { needDataColor } from '../needDataColor';
import { fmtDate, momentDayKey } from '../../utils/format';
import type { YsqHistoryEntry } from '../../../../shared/src/apiTypes';
import type { YsqRow } from './ysqRows';
import { useIsMobile } from '../useIsMobile';
import { seriesDashes, labelIndexes } from './ysqSeriesStyle';

// Холст рисуется в тех пикселях, в которых виден: на телефоне viewBox 820 ужимался до ~330px,
// и подписи 10 превращались в ~4px (QA 2026-11, T-7). Узкий — свой viewBox 300 и шрифт 12.
const CL = 30, CT = 14, CB = 192, CH = CB - CT;

/** Динамика топ-схем по прохождениям (нужно ≥2): средний балл 1–6 — та же мера, что в таблице и у клиента. */
export function YSQDynamics({ chronHist, top }: { chronHist: YsqHistoryEntry[]; top: YsqRow[] }) {
  const compact = useIsMobile();
  const VW = compact ? 300 : 820, FS = compact ? 12 : 11;
  const CR = VW - (compact ? 14 : 40), CW = CR - CL;
  const xOf = (i: number) => CL + (chronHist.length > 1 ? (i / (chronHist.length - 1)) * CW : CW / 2);
  const yOf = (avg: number) => CB - ((Math.max(1, avg) - 1) / 5) * CH;
  // Цвет линии — цвет данных потребности домена (решение 7), как полоса в таблице; схемы одного домена различает штрих.
  const needOf = new Map(top.map(r => [r.id, r.needId]));
  const colorOf = (id: string) => { const n = needOf.get(id); return (n && needDataColor(n)) ?? 'var(--text-sub)'; };
  const dashOf = seriesDashes(top.map(r => r.id), colorOf);
  const labelAt = new Set(labelIndexes(chronHist.length, compact ? 3 : 8));

  return (
    <div className="ds-card">
      <div className="ds-label tb-chart-label">Динамика топ-5 схем · средний балл</div>
      <svg viewBox={`0 0 ${VW} 230`} className="tb-chart" role="img" aria-label="Динамика топ-5 схем по прохождениям">
        {[1, 2, 3, 4, 5, 6].map(v => (
          <g key={v}>
            <line x1={CL} x2={CR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={CL - 6} y={yOf(v) + 4} fontSize={FS} fill="var(--text-faint)" textAnchor="end">{v}</text>
          </g>
        ))}
        {chronHist.map((run, i) => labelAt.has(i) && (
          <text key={run.id} x={xOf(i)} y={CB + 20} fontSize={FS} fill="var(--text-faint)"
            textAnchor={i === 0 && compact ? 'start' : i === chronHist.length - 1 && compact ? 'end' : 'middle'}>
            {fmtDate(momentDayKey(run.completedAt))}
          </text>
        ))}
        {top.map(({ id }) => {
          const color = colorOf(id);
          const points = chronHist.map((run, i) => {
            const sc = run.scores.find(s => s.id === id);
            return sc?.avg ? `${xOf(i)},${yOf(sc.avg)}` : null;
          }).filter(Boolean).join(' ');
          const lastScore = chronHist[chronHist.length - 1].scores.find(s => s.id === id);
          return (
            <g key={id}>
              <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray={dashOf[id] || undefined} opacity={0.9} />
              {lastScore?.avg ? <circle cx={xOf(chronHist.length - 1)} cy={yOf(lastScore.avg)} r={4} fill={color} /> : null}
            </g>
          );
        })}
      </svg>
      <div className="tb-legend">
        {top.map(r => (
          <div key={r.id} className="tb-legend-item">
            <svg width={26} height={8} aria-hidden="true">
              <line x1={0} x2={26} y1={4} y2={4} stroke={colorOf(r.id)} strokeWidth={2.5} strokeDasharray={dashOf[r.id] || undefined} />
            </svg>
            <span>{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
