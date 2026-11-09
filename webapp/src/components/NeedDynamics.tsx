import type { DayHistory } from '../types';
import { SignArt } from './art/SignArt';
import { ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { needTrend, sparkPaths } from './needTrend';

const W = 240;
const H = 56;

/**
 * Главное содержание листа «Динамика потребности»: направление за неделю Literata 40, спарклайн
 * на всю ширину цветом данных потребности (--nd), сравнение с детством строкой со знаком колеса
 * детства. Лежит на бумаге страницы под листом потребности (на компьютере — в левой колонке
 * разворота), а не в белой карточке сбоку. Данные — только реальные: нет детства — нет строки.
 */
export function NeedDynamics({ needId, history, childhoodValue }: { needId: string; history: DayHistory[]; childhoodValue?: number }) {
  const trend = needTrend(history.map((d) => d.ratings[needId] ?? 0));
  const oldestFirst = [...history].reverse().map((d) => d.ratings[needId] ?? 0);
  const spark = sparkPaths(oldestFirst, W, H);
  const now = trend.recentAvg;
  const childY = childhoodValue === undefined ? null : spark.yFor(childhoodValue);
  return (
    <section className="tk2-dyn">
      <span className="ds-label">За 7 дней</span>
      <div className="tk2-trend">{trend.label}</div>
      <div className="tk2-trend-sub">{trend.diffText} к предыдущей неделе</div>
      {oldestFirst.length > 1 && (
        <div className="tk2-chart-box">
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tk2-chart" aria-hidden="true">
            <path d={spark.area} className="tk2-area" />
            <path d={spark.line} className="tk2-line" />
            {childY !== null && <line x1={0} y1={childY} x2={W} y2={childY} className="tk2-ref" strokeWidth={1} />}
          </svg>
          {/* Точка — разметкой поверх: svg тянется по ширине (preserveAspectRatio="none"), круг в нём сплющивался. */}
          {spark.last && <span className="tk2-dot-pt" style={{ top: `${(spark.last.y / H) * 100}%` }} />}
        </div>
      )}
      {/* Подпись пунктира — легендой под графиком: на линии она наезжала на саму неделю. */}
      {childY !== null && oldestFirst.length > 1 && <span className="tk2-ref-t">детство {childhoodValue}</span>}
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
                  → сейчас {now.toFixed(1)} {now > childhoodValue ? '↑' : now < childhoodValue ? '↓' : ''}
                </span>
              )}
            </div>
            <p className="tk2-child-note">
              {childhoodValue <= 4
                ? 'Давняя чувствительная зона – вероятно паттерн, а не ситуация'
                : 'В детстве удовлетворялась. Если сейчас низко – скорее истощение'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
