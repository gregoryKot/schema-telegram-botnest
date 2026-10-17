import type { Need, DayHistory } from '../../types';
import type { NeedId } from '../../../../shared/src/needs/types';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';

interface Props {
  need: Need; history: DayHistory[]; selectedIdx: number;
  selectedRatings: Record<string, number>; onClick?: () => void;
}

const W = 100, H = 28;
const yFor = (v: number) => v === 0 ? H - 1 : 25 - ((Math.min(v, 10) - 1) / 9) * 23;

/** Строка «потребность — линия за период — оценка выбранного дня и стрелка». */
export function SparklineRow({ need, history, selectedIdx, selectedRatings, onClick }: Props) {
  const reversed = [...history].reverse();
  const n = reversed.length;
  const xStep = n > 1 ? W / (n - 1) : W / 2;
  const pts = reversed.map((day, i) => ({ x: i * xStep, y: yFor(day.ratings[need.id] ?? 0) }));
  const dot = pts[Math.max(0, Math.min(n - 1 - selectedIdx, n - 1))];
  const score = selectedRatings[need.id] ?? 0;
  const delta = score - (history[selectedIdx + 1]?.ratings[need.id] ?? score);
  const trend = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '–';
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[n - 1].x.toFixed(1)} ${H} L 0 ${H} Z`;
  const polyStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className={'ds-list-row sd-spark-row' + (onClick ? ' ds-list-row--hover' : '')}
      style={hueStyle(NEED_HUE[need.id as NeedId])} {...(onClick ? pressable(onClick) : {})}>
      <span className="sd-spark-name">{need.chartLabel}</span>
      <svg className="sd-spark-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={areaPath} className="sd-spark-area" />
        <polyline points={polyStr} className="sd-spark-line" />
        <circle cx={dot.x} cy={dot.y} r={3.5} className="sd-spark-dot" />
      </svg>
      <span className="sd-spark-score tone-text">
        {score || '–'}
        {score > 0 && <small className={'sd-trend ' + trend}>{arrow}</small>}
      </span>
    </div>
  );
}
