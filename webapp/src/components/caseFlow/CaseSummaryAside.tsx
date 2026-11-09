// Лист «Что собрали» разбора (редизайн 2026-11, b09): белый лист бумаги с ответами человека —
// строка на ответ, слева знак строки (caseSummary.ts: лента — только у момента, у остальных строк
// колонка знака пустая). Один компонент на два места: колонка разворота на шагах (на компьютере, растёт по мере
// ответов) и итог «Похоже на режим». Только реальные ответы: нет строк — листа нет. На итоге лента уже
// в сцене-герое (SceneCaseFound) — там `signs={false}`: без колонки знаков, лента в кадре одна (ревью g2 r3).
import type { QuickResultRow } from '../../../../shared/src/case/quick/caseQuick';
import { SignArt } from '../art/SignArt';
import { rowSign } from './caseSummary';
import '../../styles/case-quick.css';

export function CaseSummaryAside({ rows, className, signs = true }: { rows: QuickResultRow[]; className?: string; signs?: boolean }) {
  if (rows.length === 0) return null;
  const cls = ['cq-summary', !signs && 'cq-summary--nosign', className].filter(Boolean).join(' ');
  return (
    <section className={cls} aria-label="Что собрали">
      <div className="ds-label cq-summary-label">Что собрали</div>
      {rows.map((r) => {
        const sign = rowSign(r.label);
        return (
          <div key={r.label} className="cq-row">
            {signs && <span className="cq-row-sign" aria-hidden="true">{sign && <SignArt sign={sign} size="row" />}</span>}
            <span className="cq-row-label">{r.label}</span>
            <span className="cq-row-text">{r.text}</span>
          </div>
        );
      })}
    </section>
  );
}
