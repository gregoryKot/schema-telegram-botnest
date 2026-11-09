import type { DayHistory } from '../types';
import { SignArt } from './art/SignArt';
import { ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { needTrend } from '../../../shared/src/history/needTrend';
import { SPARK_H, SPARK_W, sparkY, sparklineGeometry } from '../../../shared/src/history/sparkline';
import { fmtIndex } from '../../../shared/src/needs/dayIndex';
import { glue } from '../../../shared/src/utils/typo';

/**
 * Главное содержание листа «Динамика потребности»: направление за неделю Literata 40, спарклайн
 * на всю ширину цветом данных потребности (--nd), сравнение с детством строкой со знаком колеса
 * детства. Лежит на бумаге страницы под листом потребности (на компьютере — в левой колонке
 * разворота), а не в белой карточке сбоку. Данные — только реальные: нет детства — нет строки.
 */
export function NeedDynamics({ needId, history, childhoodValue }: { needId: string; history: DayHistory[]; childhoodValue?: number }) {
  const trend = needTrend(history.map((d) => d.ratings[needId] ?? 0));
  // Линия — та же геометрия, что «Неделя» в истории (sparkline.ts): одна кривая одной недели.
  const g = sparklineGeometry(history, needId);
  const now = trend.recentAvg;
  const childY = childhoodValue === undefined ? null : sparkY(childhoodValue);
  const chart = history.length > 1;
  return (
    <section className="tk2-dyn">
      <span className="ds-label">За 7 дней</span>
      <div className="tk2-trend">{trend.label}</div>
      <div className="tk2-trend-sub">{trend.diffText} к предыдущей неделе</div>
      {chart && (
        <div className="tk2-chart-box">
          <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" className="tk2-chart" aria-hidden="true">
            <path d={g.area} className="tk2-area" />
            <path d={g.line} className="tk2-line" />
            {childY !== null && <line x1={0} y1={childY} x2={SPARK_W} y2={childY} className="tk2-ref" strokeWidth={1} />}
          </svg>
          {/* Точка — разметкой поверх: svg тянется по ширине (preserveAspectRatio="none"), круг в нём сплющивался. */}
          <span className="tk2-dot-pt" style={{ left: `${g.dot.left}%`, top: `${g.dot.top}%` }} />
        </div>
      )}
      {/* Подпись пунктира — легендой под графиком: на линии она наезжала на саму неделю. */}
      {childY !== null && chart && <span className="tk2-ref-t">детство {childhoodValue}</span>}
      {childhoodValue !== undefined && (
        <div className="tk2-child">
          <span className="pp-row-art"><SignArt sign={ENTITY_LOOK.childhood_wheel.sign} size="row" /></span>
          <div className="tk2-child-body">
            <span className="ds-label">В детстве</span>
            <div className="tk2-child-nums">
              <span className="tk2-child-num">{childhoodValue}</span>
              <span className="tk2-child-of">/10</span>
              {now > 0 && (
                <span className="tk2-child-now">
                  → сейчас {fmtIndex(now)} {now > childhoodValue ? '↑' : now < childhoodValue ? '↓' : ''}
                </span>
              )}
            </div>
            <p className="tk2-child-note">
              {glue(childhoodValue <= 4
                ? 'Давняя чувствительная зона – вероятно паттерн, а не ситуация'
                : 'В детстве удовлетворялась. Если сейчас низко – скорее истощение')}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
