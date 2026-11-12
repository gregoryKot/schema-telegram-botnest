import type { CSSProperties } from 'react';
import { inkVars } from '../history/needInk';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { deltaClass, fmtDelta, type YsqRow } from './ysqRows';

// Таблица «Схемы» терапевта: средний балл, доля «5–6» и отметка «выражена» — как у клиента в «Выраженных схемах».
// Бар — по среднему баллу цветом данных потребности домена (inkVars); лист .pp-leaf глины YSQ (r2).
export function YSQTable({ rows, hasPrev }: { rows: YsqRow[]; hasPrev: boolean }) {
  return (
    <div className="ds-card pp-leaf tb-ysq-card" style={{ '--h': ENTITY_LOOK.ysq.hue } as CSSProperties}>
      <div className="tb-ysq-row tb-ysq-head ds-label">
        <span>Схема</span>
        <span className="tb-ysq-barcol">Средний балл{hasPrev ? ' · сейчас и прошлый раз' : ''}</span>
        <span className="tb-r">Балл</span>
        <span className="tb-r" title="Доля ответов «5» и «6»">5–6</span>
        <span className="tb-r">Δ</span>
      </div>
      {rows.map(r => (
        <div key={r.id} className={`tb-ysq-row${r.active ? ' is-active' : ''}`} style={inkVars(r.needId ?? '') as CSSProperties}>
          <span className="tb-ysq-name">
            {r.name}
            {r.active && <span className="tb-ysq-mark">выражена</span>}
          </span>
          <div className="tb-bar">
            {r.prevBarPct != null && <div className="tb-bar-prev" style={{ width: `${r.prevBarPct}%` }} />}
            <div className="tb-bar-fill" style={{ width: `${r.barPct}%` }} />
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
