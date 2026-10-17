import type { MutableRefObject } from 'react';
import type { Need, DayHistory } from '../../types';
import { dayAvg, dayLevel, getDayAbbr, getDayNum } from './historyMath';

interface Props {
  history: DayHistory[];
  needs: Need[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  btnRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
}

/** Лента дней: выбранный — тёмная плашка, под числом полоска среднего за день. */
export function DateStrip({ history, needs, selectedIdx, onSelect, btnRefs }: Props) {
  return (
    <div className="sd-days">
      {history.map((day, i) => {
        const avg = dayAvg(day, needs);
        return (
          <button key={day.date} ref={el => { btnRefs.current[i] = el; }}
            onClick={() => onSelect(i)}
            className={'sd-day' + (i === selectedIdx ? ' is-active' : '')}>
            <span className="sd-day-dow">{getDayAbbr(day.date)}</span>
            <span className="sd-day-num">{getDayNum(day.date)}</span>
            <span className="sd-day-bar">
              {avg !== null && (
                <i className={'is-' + dayLevel(avg)} style={{ width: `${Math.round((avg / 10) * 100)}%` }} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
