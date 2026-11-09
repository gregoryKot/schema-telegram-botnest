// Лист «Что собрали» разбора (редизайн 2026-11, b09): белый лист бумаги с ответами человека —
// строка на ответ, слева знак строки (caseSummary.ts: момент — лента, внутри — полоски, хотелось —
// камешки). Один компонент на два места: колонка разворота на шагах (на компьютере, растёт по мере
// ответов) и итог «Похоже на режим». Только реальные ответы: нет строк — листа нет.
import type { QuickResultRow } from '../../../../shared/src/case/quick/caseQuick';
import { SignArt } from '../art/SignArt';
import { rowSign } from './caseSummary';
import '../../styles/case-quick.css';

export function CaseSummaryAside({ rows, className }: { rows: QuickResultRow[]; className?: string }) {
  if (rows.length === 0) return null;
  return (
    <section className={className ? `cq-summary ${className}` : 'cq-summary'} aria-label="Что собрали">
      <div className="ds-label cq-summary-label">Что собрали</div>
      {rows.map((r) => {
        const sign = rowSign(r.label);
        return (
          <div key={r.label} className="cq-row">
            <span className="cq-row-sign" aria-hidden="true">{sign && <SignArt sign={sign} size="row" />}</span>
            <span className="cq-row-label">{r.label}</span>
            <span className="cq-row-text">{r.text}</span>
          </div>
        );
      })}
    </section>
  );
}
