import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { fmtDate, momentDayKey } from '../../utils/format';
import type { YsqHistoryEntry } from '../../../../shared/src/apiTypes';
import type { YsqRow } from './ysqRows';

const CL = 44, CR = 780, CT = 14, CB = 192, CW = CR - CL, CH = CB - CT;
const SCHEMAS_FLAT = SCHEMA_DOMAINS.flatMap(d => d.schemas.map(s => ({ ...s, domainColor: d.color })));

/** Динамика топ-схем по прохождениям (нужно ≥2): средний балл 1–6 — та же мера, что в таблице и у клиента. */
export function YSQDynamics({ chronHist, top }: { chronHist: YsqHistoryEntry[]; top: YsqRow[] }) {
  const xOf = (i: number) => CL + (chronHist.length > 1 ? (i / (chronHist.length - 1)) * CW : CW / 2);
  const yOf = (avg: number) => CB - ((Math.max(1, avg) - 1) / 5) * CH;
  const colorOf = (id: string) => SCHEMAS_FLAT.find(s => s.id === id)?.domainColor ?? 'var(--accent)';

  return (
    <div className="ds-card">
      <div className="ds-label tb-chart-label">Динамика топ-5 схем · средний балл</div>
      <svg viewBox="0 0 820 230" className="tb-chart">
        {[1, 2, 3, 4, 5, 6].map(v => (
          <g key={v}>
            <line x1={CL} x2={CR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={CL - 8} y={yOf(v) + 4} fontSize={10} fill="var(--text-faint)" textAnchor="end">{v}</text>
          </g>
        ))}
        {chronHist.map((run, i) => (
          <text key={run.id} x={xOf(i)} y={CB + 18} fontSize={10} fill="var(--text-faint)" textAnchor="middle">
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
              <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" opacity={0.75} />
              {lastScore?.avg ? <circle cx={xOf(chronHist.length - 1)} cy={yOf(lastScore.avg)} r={4} fill={color} /> : null}
            </g>
          );
        })}
      </svg>
      <div className="tb-legend">
        {top.map(r => (
          <div key={r.id} className="tb-legend-item">
            <span className="ds-dot" style={{ background: colorOf(r.id) }} />
            <span>{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
