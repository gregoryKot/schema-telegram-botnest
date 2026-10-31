import type { Need } from '../../types';
import { useNeedData } from '../../needData';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import { wordForValue } from '../../../../shared/src/needs/ratingWords';

const BAR_MAX_PX = 96;

/** Пять столбиков дня: высота по оценке, цвет потребности, подпись `short`; без оценки — тонкая полоска. */
export function DayBars({ needs, ratings }: { needs: Need[]; ratings: Record<string, number> }) {
  const NEED_DATA = useNeedData();
  return (
    <ul className="tq-bars" aria-label="Оценки по потребностям">
      {needs.map((n) => {
        const v = ratings[n.id] ?? 0;
        return (
          <li key={n.id} aria-label={`${NEED_DATA[n.id]?.name ?? n.chartLabel}: ${wordForValue(v)?.label ?? 'нет оценки'}`}>
            <span
              className={'tq-bar-col' + (v > 0 ? ' tone-fill' : '')}
              style={{ ...hueStyle(NEED_HUE[n.id as NeedId]), height: v > 0 ? Math.round((v / 10) * BAR_MAX_PX) : 4 }}
            />
            <span className="tq-bar-cap" aria-hidden="true">{NEED_DATA[n.id]?.short ?? n.chartLabel}</span>
          </li>
        );
      })}
    </ul>
  );
}
