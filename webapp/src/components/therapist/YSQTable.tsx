import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import { deltaClass, fmtDelta, YSQ_HIGH_PCT, type YsqRow } from './ysqRows';

export function YSQTable({ rows, hasPrev }: { rows: YsqRow[]; hasPrev: boolean }) {
  return (
    <div className="ds-card tb-ysq-card">
      <div className="tb-ysq-row tb-ysq-head ds-label">
        <span>Схема</span>
        <span className="tb-ysq-barcol">% ответов 5–6{hasPrev ? ' · сейчас и прошлый раз' : ''}</span>
        <span className="tb-r">Сейчас</span>
        <span className="tb-r">Δ</span>
      </div>
      {rows.map(r => (
        <div key={r.id} className="tb-ysq-row">
          <span className={`tb-ysq-name${r.top ? ' is-top' : ''}`}>{r.name}</span>
          <div className="tb-bar">
            {r.prevPct != null && <div className="tb-bar-prev" style={{ width: `${r.prevPct}%` }} />}
            <div className="tb-bar-fill tone-fill" style={{ ...hueStyle(r.domainId ? DOMAIN_HUE[r.domainId] : undefined), width: `${r.pct}%` }} />
          </div>
          <span className={`tb-ysq-val tb-r${r.pct > YSQ_HIGH_PCT ? ' is-high' : ''}`}>{r.pct}%</span>
          <span className={`tb-ysq-delta tb-r ${deltaClass(r.delta)}`}>{fmtDelta(r.delta)}</span>
        </div>
      ))}
    </div>
  );
}
