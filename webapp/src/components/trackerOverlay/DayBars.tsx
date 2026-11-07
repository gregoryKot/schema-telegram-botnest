import type { CSSProperties } from 'react';
import type { Need } from '../../types';
import { useNeedData } from '../../needData';
import { BAR_PAPER } from '../art/paper';
import { wordForValue } from '../../../../shared/src/needs/ratingWords';

const BAR_MAX_PX = 96;

/**
 * Пять столбиков дня: высота по оценке, подпись `short`; без оценки — тонкая полоска.
 * Цвет — бумажная палитра полосок Strokes над ними (BAR_PAPER), а не цвета потребностей:
 * экран «Готово» — один лист цветной бумаги, две палитры рядом спорили.
 */
export function DayBars({ needs, ratings }: { needs: Need[]; ratings: Record<string, number> }) {
  const NEED_DATA = useNeedData();
  return (
    <ul className="tq-bars" aria-label="Оценки по потребностям">
      {needs.map((n, i) => {
        const v = ratings[n.id] ?? 0;
        const style = { height: v > 0 ? Math.round((v / 10) * BAR_MAX_PX) : 4, ...(v > 0 && { '--bar': BAR_PAPER[i % BAR_PAPER.length] }) };
        return (
          <li key={n.id} aria-label={`${NEED_DATA[n.id]?.name ?? n.chartLabel}: ${wordForValue(v)?.label ?? 'нет оценки'}`}>
            <span className={'tq-bar-col' + (v > 0 ? ' is-rated' : '')} style={style as CSSProperties} />
            <span className="tq-bar-cap" aria-hidden="true">{NEED_DATA[n.id]?.short ?? n.chartLabel}</span>
          </li>
        );
      })}
    </ul>
  );
}
