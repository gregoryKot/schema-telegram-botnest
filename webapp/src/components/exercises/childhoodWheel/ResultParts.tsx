import type { CSSProperties } from 'react';
import { useTr } from '../../../utils/addressForm';
import { NeedArt } from '../../art/NeedArt';
import { inkVars } from '../../history/needInk';
import { ExNext } from '../ExNext';
import { childhoodLevel } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import { NEEDS } from './needs';

/**
 * Пять оценок результата плотным списком: знак потребности, название и полюс шкалы, к которому оценка
 * ближе, справа число Literata цветом текста потребности (needInk — как в «Истории»). Колесо — в листе-герое.
 */
export function ResultRows({ ratings }: { ratings: Record<string, number> }) {
  return (
    <ul className="chw-res">
      {NEEDS.map((n) => {
        const r = ratings[n.id];
        return (
          <li key={n.id} className="chw-res-row" style={inkVars(n.id) as CSSProperties}>
            <span className="pp-row-art" aria-hidden="true"><NeedArt id={n.id} size="row" /></span>
            <span className="chw-res-body">
              <span className="chw-res-label">{n.label}</span>
              <span className="chw-res-text">{{ low: n.low, high: n.high, mid: 'Где-то между. Бывало по-разному.' }[childhoodLevel(r)]}</span>
            </span>
            <span className="chw-res-value">{r}<span>/10</span></span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * «Что дальше: связать с сегодня» — плитка ExNext на соломе трекера со знаком Strokes: ведёт в «Историю» трекера,
 * где видно, какие потребности просели сегодня. Хост не дал перехода — тот же лист без стрелки, не кнопкой.
 */
export function NextToday({ onOpen }: { onOpen?: () => void }) {
  const tr = useTr();
  return (
    <ExNext entity="tracker" className="chw-next" label="Что дальше" title="Связать с сегодня" onOpen={onOpen} text={tr(
      'Открой дневник за последнюю неделю и сравни – какие потребности сегодня просели больше всего. Часто это те же зоны.',
      'Откройте дневник за последнюю неделю и сравните – какие потребности сегодня просели больше всего. Часто это те же зоны.',
    )} />
  );
}
