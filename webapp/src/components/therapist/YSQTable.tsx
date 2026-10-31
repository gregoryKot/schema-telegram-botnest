import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import { deltaClass, fmtDelta, type YsqRow } from './ysqRows';

// Таблица «Схемы» терапевта: обе величины критерия выраженности (средний балл
// и доля «5–6») и отметка «выражена» — та же, по которой клиент видит схему в
// «Выраженных схемах». Бар — по среднему баллу, как у клиента.
export function YSQTable({ rows, hasPrev }: { rows: YsqRow[]; hasPrev: boolean }) {
  return (
    <div className="ds-card tb-ysq-card">
      <div className="tb-ysq-row tb-ysq-head ds-label">
        <span>Схема</span>
        <span className="tb-ysq-barcol">Средний балл{hasPrev ? ' · сейчас и прошлый раз' : ''}</span>
        <span className="tb-r">Балл</span>
        <span className="tb-r" title="Доля ответов «5» и «6»">5–6</span>
        <span className="tb-r">Δ</span>
      </div>
      {rows.map(r => (
        <div key={r.id} className={`tb-ysq-row${r.active ? ' is-active' : ''}`} style={hueStyle(r.domainId ? DOMAIN_HUE[r.domainId] : undefined)}>
          <span className="tb-ysq-name">
            {r.name}
            {r.active && <span className="tb-ysq-mark tone-ink">выражена</span>}
          </span>
          <div className="tb-bar">
            {r.prevBarPct != null && <div className="tb-bar-prev" style={{ width: `${r.prevBarPct}%` }} />}
            <div className="tb-bar-fill tone-fill" style={{ width: `${r.barPct}%` }} />
          </div>
          <span className="tb-ysq-val tb-r">{r.avgLabel}</span>
          <span className="tb-ysq-pct tb-r">{r.pct}%</span>
          <span className={`tb-ysq-delta tb-r ${deltaClass(r.delta)}`}>{fmtDelta(r.delta)}</span>
        </div>
      ))}
      <div className="tb-ysq-note">Выражена — как у клиента: средний балл от 4 из 6 или больше половины ответов «5–6».</div>
    </div>
  );
}
