import type { DayHistory } from '../types';
import { SignArt } from './art/SignArt';
import { ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { needTrend } from '../../../shared/src/history/needTrend';
import { SPARK_H, SPARK_W, WEEK_DAYS, sparkY, sparklineGeometry, weekWindow } from '../../../shared/src/history/sparkline';
import { fmtIndex } from '../../../shared/src/needs/dayIndex';
import { glue } from '../../../shared/src/utils/typo';

/**
 * Главное содержание листа «Динамика потребности»: направление за неделю Literata 40, спарклайн
 * на всю ширину цветом данных потребности (--nd), сравнение с детством строкой со знаком колеса
 * детства. Лежит на бумаге страницы под листом потребности (на компьютере — в левой колонке
 * разворота), а не в белой карточке сбоку. Данные — только реальные: нет детства — нет строки;
 * нет оценок в прошлой неделе — нет сравнения с ней; день без оценки линия пропускает (одиночный день —
 * точкой, через пропуск — тихий мостик пунктиром).
 * Неделя — та же, что у строки «Недели» в истории: 7 дней, которые кончаются выбранным днём.
 */
export function NeedDynamics({ needId, history, selectedIdx = 0, childhoodValue }: { needId: string; history: DayHistory[]; selectedIdx?: number; childhoodValue?: number }) {
  const week = weekWindow(history, selectedIdx, WEEK_DAYS);
  const score = (d: DayHistory) => d.ratings[needId] ?? 0;
  const trend = needTrend(week.map(score), weekWindow(history, selectedIdx + WEEK_DAYS, WEEK_DAYS).map(score));
  // Линия — та же геометрия и то же окно, что строка «Недели» в истории: одна кривая одной недели.
  const g = sparklineGeometry(week, needId);
  const now = trend?.recentAvg ?? 0; // три самых новых дня с оценкой, как в main (ревью g2 r4)
  const childY = childhoodValue === undefined ? null : sparkY(childhoodValue);
  const chart = week.length > 1 && g.count > 0;
  return (
    <section className="tk2-dyn">
      <span className="ds-label">За 7 дней</span>
      {/* Нет оценок в неделе — «—» под подписью, а не подпись над пустым местом. */}
      <div className="tk2-trend">{trend?.label ?? '—'}</div>
      {trend?.diffText && <div className="tk2-trend-sub">{trend.diffText} к предыдущей неделе</div>}
      {chart && (
        <div className="tk2-chart-box">
          <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" className="tk2-chart" aria-hidden="true">
            <path d={g.area} className="tk2-area" />
            <path d={g.gaps} className="tk2-gap" />
            <path d={g.line} className="tk2-line" />
            <path d={g.singles} className="tk2-pts" />
            {childY !== null && <line x1={0} y1={childY} x2={SPARK_W} y2={childY} className="tk2-ref" strokeWidth={1} />}
          </svg>
          {/* Точка — разметкой поверх: svg тянется по ширине (preserveAspectRatio="none"), круг в нём сплющивался. */}
          {g.dot && <span className="tk2-dot-pt" style={{ left: `${g.dot.left}%`, top: `${g.dot.top}%` }} />}
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
