import type { CSSProperties } from 'react';
import type { Need, DayHistory } from '../../types';
import type { NeedId } from '../../../../shared/src/needs/types';
import { SPARK_H, SPARK_W, sparklineGeometry } from '../../../../shared/src/history/sparkline';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import { NeedArt } from '../art/NeedArt';
import { inkVars } from './needInk';
/** `days` — окно «За N дней» (weekWindow): выбранный день первым. */
interface Props { need: Need; days: DayHistory[]; selectedRatings: Record<string, number>; onClick?: () => void }
/** Пути одной линии (sparklineGeometry): заливка, мостики через пропуск, линия; одиночные дни — маркерами. */
const PATHS = [['area', 'sd-spark-area'], ['gaps', 'sd-spark-gap'], ['line', 'sd-spark-line']] as const;
/** «Потребность — линия — оценка»: строка на телефоне, карточка с 768; цвет — needInk.ts; маркер дня — HTML (в svg круг сплющивался). */
export function SparklineRow({ need, days, selectedRatings, onClick }: Props) {
  const g = sparklineGeometry(days, need.id);
  const score = selectedRatings[need.id] ?? 0;
  const delta = score - (days[1]?.ratings[need.id] ?? score);
  const trend = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '–';
  return (
    <div className={'ds-list-row sd-spark-row' + (onClick ? ' ds-list-row--hover' : '')}
      style={{ ...hueStyle(NEED_HUE[need.id as NeedId]), ...inkVars(need.id) } as CSSProperties} {...(onClick ? pressable(onClick) : {})}>
      <span className="sd-spark-name"><NeedArt id={need.id} size="row" />{need.chartLabel}</span>
      <span className="sd-spark-plot">
        <svg className="sd-spark-svg" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
          {PATHS.map(([k, cls]) => <path key={k} d={g[k]} className={cls} />)}
        </svg>
        {g.points.map((p) => <span key={p.left} className="sd-spark-pt" style={{ left: `${p.left}%`, top: `${p.top}%` }} />)}
        {g.dot && <span className="sd-spark-dot" style={{ left: `${g.dot.left}%`, top: `${g.dot.top}%` }} />}
      </span>
      <span className="sd-spark-score">
        {score || '–'}
        {score > 0 && <small className={'sd-trend ' + trend}>{arrow}</small>}
      </span>
    </div>
  );
}
