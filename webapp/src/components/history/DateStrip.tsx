import type { MutableRefObject } from 'react';
import type { DayHistory } from '../../types';
import { Strokes } from '../art/PaperArt';
import { getDayAbbr, getDayNum } from './historyMath';
import { dayValues, useStripEdges } from './dayStrip';

interface Props {
  history: DayHistory[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  btnRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
}

/**
 * Лента дней: каждый день — листок с пятью полосками своих оценок (Strokes values, пустой тон —
 * не оценена), выбранный — листок бумаги трекера с тенью. В ширину ленты — семь дней; за краем
 * есть ещё — край затухает, а не режет листок (dayStrip.ts, history.css).
 */
export function DateStrip({ history, selectedIdx, onSelect, btnRefs }: Props) {
  const { ref: strip, edges, measure } = useStripEdges(history.length);
  return (
    <div ref={strip} className="sd-days" onScroll={measure}
      data-fade-start={edges.start ? '' : undefined} data-fade-end={edges.end ? '' : undefined}>
      {history.map((day, i) => (
        <button key={day.date} ref={el => { btnRefs.current[i] = el; }} type="button"
          onClick={() => onSelect(i)} aria-pressed={i === selectedIdx}
          className={'sd-day' + (i === selectedIdx ? ' is-active' : '')}>
          <span className="sd-day-date"><span className="sd-day-dow">{getDayAbbr(day.date)}</span><span className="sd-day-num">{getDayNum(day.date)}</span></span>
          <span className="sd-day-strokes" aria-hidden="true"><Strokes values={dayValues(day.ratings)} size="nav" /></span>
        </button>
      ))}
    </div>
  );
}
