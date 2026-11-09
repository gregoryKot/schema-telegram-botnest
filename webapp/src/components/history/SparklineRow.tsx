import type { CSSProperties } from 'react';
import type { Need, DayHistory } from '../../types';
import type { NeedId } from '../../../../shared/src/needs/types';
import { SPARK_H, SPARK_W, sparklineGeometry } from '../../../../shared/src/history/sparkline';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import { NeedArt } from '../art/NeedArt';
import { inkVars } from './needInk';
interface Props {
  /** Окно «За N дней» (weekWindow): выбранный день первым. */
  need: Need; days: DayHistory[]; selectedRatings: Record<string, number>; onClick?: () => void;
}
/** «Потребность — линия — оценка и стрелка»: строка на телефоне, карточка на бумаге потребности с 768; цвет — needInk.ts. */
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
      {/* Маркер — HTML поверх растянутого svg: в svg круг сплющивался в овал. */}
      <span className="sd-spark-plot">
        <svg className="sd-spark-svg" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
          <path d={g.area} className="sd-spark-area" />
          <path d={g.line} className="sd-spark-line" />
        </svg>
        {g.dot && <span className="sd-spark-dot" style={{ left: `${g.dot.left}%`, top: `${g.dot.top}%` }} />}
      </span>
      <span className="sd-spark-score">
        {score || '–'}
        {score > 0 && <small className={'sd-trend ' + trend}>{arrow}</small>}
      </span>
    </div>
  );
}
