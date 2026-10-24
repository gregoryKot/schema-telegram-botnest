import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { hueStyle } from '../../lib/tone';
import { MonthShareButton } from './heatmapShare';
import { PROFILE_HUE } from './profileMeta';
import { buildHeatWeeks, monthLabels } from './profileModel';
import { useHeatWeeks } from './useHeatWeeks';

interface Props { levels: Map<string, number>; activeDates: Set<string>; totalDays: number }

// Подписи строк (пн–вс) через одну — только на телефоне (css), как в мини-аппе.
const DAY_LABELS = ['пн', '', 'ср', '', 'пт', '', 'вс'];

export function ActivityHeatmap({ levels, activeDates, totalDays }: Props) {
  const weekCount = useHeatWeeks();
  const weeks = useMemo(() => buildHeatWeeks(levels, new Date(), weekCount), [levels, weekCount]);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);
  return (
    <section className="ds-card cpf-card cpf-heat-card" style={hueStyle(PROFILE_HUE)}>
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
    </section>
  );
}
