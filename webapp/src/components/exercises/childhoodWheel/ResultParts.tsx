import type { CSSProperties } from 'react';
import { useTr } from '../../../utils/addressForm';
import { NeedArt } from '../../art/NeedArt';
import { SignArt } from '../../art/SignArt';
import { inkVars } from '../../history/needInk';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { NEEDS } from './needs';

/** Ниже этой оценки и выше этой — текст полюса шкалы, между — «Где-то между». */
const LOW_MAX = 4;
const HIGH_MIN = 8;

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
              <span className="chw-res-text">{r <= LOW_MAX ? n.low : r >= HIGH_MIN ? n.high : 'Где-то между. Бывало по-разному.'}</span>
            </span>
            <span className="chw-res-value">{r}<span>/10</span></span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * «Что дальше: связать с сегодня» — плитка соломы трекера со знаком Strokes: ведёт в «Историю» трекера, где
 * видно, какие потребности просели сегодня. Хост не дал перехода — тот же лист без стрелки, не кнопкой.
 */
export function NextToday({ onOpen }: { onOpen?: () => void }) {
  const tr = useTr();
  const { hue, sign } = ENTITY_LOOK.tracker;
  const body = (
    <>
      <span className="chw-next-body">
        <span className="ds-label chw-next-label">Что дальше</span>
        <span className="chw-next-title">Связать с сегодня</span>
        <span className="chw-next-text">
          {tr(
            'Открой дневник за последнюю неделю и сравни – какие потребности сегодня просели больше всего. Часто это те же зоны.',
            'Откройте дневник за последнюю неделю и сравните – какие потребности сегодня просели больше всего. Часто это те же зоны.',
          )}
        </span>
      </span>
      <span className="chw-next-foot" aria-hidden="true">
        <SignArt sign={sign} size="square" />
        {onOpen && <span className="pp-arrow">→</span>}
      </span>
    </>
  );
  const style = { '--h': hue } as CSSProperties;
  return onOpen ? (
    <button type="button" className="pp-paper chw-next chw-next--link" style={style} onClick={onOpen}>{body}</button>
  ) : (
    <div className="pp-paper chw-next" style={style}>{body}</div>
  );
}
