import type { CSSProperties } from 'react';
import { todayStr } from '../../../../shared/src/utils/format';
import { MonthShareButton } from './heatmapShare';
import { buildHeatWeeks, monthLabels } from './profileModel';
import { useHeatWeeks } from './useHeatWeeks';

interface Props { levels: Map<string, number>; activeDates: Set<string>; totalDays: number }

// Клетки — оттенки мха (данные ≥3:1 к бумаге страницы, client-profile.css), подписи — --text-faint (≥4.5:1).
// Подписи строк (пн–вс) через одну — только на телефоне (css), как в мини-аппе.
const DAY_LABELS = ['пн', '', 'ср', '', 'пт', '', 'вс'];

export function ActivityHeatmap({ levels, activeDates, totalDays }: Props) {
  const weekCount = useHeatWeeks();
  const weeks = buildHeatWeeks(levels, todayStr(), weekCount); // местный день, каждый рендер (E5)
  const labels = monthLabels(weeks);
  return (
    <div className="cpf-heat-card">
      <div className="ds-head-row">
        <h2 className="ds-h3">Активность</h2>
        <div className="cpf-heat-tools">
          <span className="ds-sub cpf-heat-range">последние {weekCount} недель</span>
          <MonthShareButton activeDates={activeDates} totalDays={totalDays} />
        </div>
      </div>
      <div className="cpf-heat-wrap" style={{ '--cols': weekCount } as CSSProperties}>
        <div className="cpf-heat-months" aria-hidden="true">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="cpf-heat-days" aria-hidden="true">
          {DAY_LABELS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="cpf-heat-grid" role="img" aria-label={`Активность по дням за последние ${weekCount} недель`}>
          {weeks.flat().map(c => (
            <div key={c.dateStr} title={c.future ? undefined : c.dateStr}
              className={`cpf-heat${c.level > 0 ? ` cpf-heat--${c.level}` : ''}${c.future ? ' is-future' : ''}`} />
          ))}
        </div>
      </div>
      <div className="cpf-heat-legend">
        меньше
        {[0, 1, 2, 3].map(l => <span key={l} className={`cpf-heat${l > 0 ? ` cpf-heat--${l}` : ''}`} />)}
        больше
      </div>
    </div>
  );
}
