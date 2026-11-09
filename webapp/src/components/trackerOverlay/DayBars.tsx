import type { CSSProperties } from 'react';
import type { Need } from '../../types';
import { useNeedData } from '../../needData';
import { wordForValue } from '../../../../shared/src/needs/ratingWords';
import { needDataColor } from '../needDataColor';
import { ratingShare } from '../../../../shared/src/needs/ratingShare';

/**
 * Пять столбиков дня (экран «Готово»): у каждого — паз во всю высоту тоном глубже бумаги
 * (видно, куда расти, и пустой день не оставляет дыры), в нём столбик по оценке цветом данных
 * своей потребности (needDataColor, решение 7 — тот же цвет, что точки шкалы и «История»),
 * подпись `short`. Без оценки — только паз и короткая метка внизу. Высоту паза задаёт CSS
 * (--bar-max: на компьютере 140), долю — `--v`.
 */
export function DayBars({ needs, ratings }: { needs: Need[]; ratings: Record<string, number> }) {
  const NEED_DATA = useNeedData();
  return (
    <ul className="tq-bars" aria-label="Оценки по потребностям">
      {needs.map((n) => {
        const v = ratings[n.id] ?? 0;
        const color = needDataColor(n.id);
        const style = { '--v': ratingShare(v), ...(v > 0 && color && { '--bar': color }) } as CSSProperties;
        return (
          <li key={n.id} aria-label={`${NEED_DATA[n.id]?.name ?? n.chartLabel}: ${wordForValue(v)?.label ?? 'нет оценки'}`}>
            <span className="tq-bar-slot" aria-hidden="true">
              <span className={'tq-bar-col' + (v > 0 ? ' is-rated' : '')} style={style} />
            </span>
            <span className="tq-bar-cap" aria-hidden="true">{NEED_DATA[n.id]?.short ?? n.chartLabel}</span>
          </li>
        );
      })}
    </ul>
  );
}
