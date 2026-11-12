import { Fragment, type CSSProperties } from 'react';
import {
  NEED_PERIOD_LABEL,
  NEED_PERIODS,
  type ConceptNeedLink,
  type NeedPeriod,
} from '../needLinks';
import { hasNeedRatings } from './diagramNeedPct';
import type { DiagramLayout } from './diagramTypes';

/** Зона нажатия кнопки периода; видимая часть — слово. */
const HIT = 44;
/** От середины подписи круга вверх до середины строки переключателя. */
const ABOVE_TITLE = 20;

const word = (on: boolean): CSSProperties => ({
  minWidth: HIT,
  minHeight: HIT,
  padding: '0 2px',
  border: 'none',
  background: 'none',
  font: 'inherit',
  color: on ? 'var(--text)' : 'var(--text-sub)',
  textDecoration: on ? 'underline' : 'none',
  textDecorationThickness: 2,
  textUnderlineOffset: 4,
  cursor: 'pointer',
});

/**
 * За какой период таблетки показывают проценты колеса: «Детство · 11–17 лет ·
 * Сейчас» над подписью круга. Место там свободно в обоих видах: линии входят в
 * таблетки сбоку и по просветам между рядами, раскладка не двигается. Без
 * единой оценки переключателя нет. В картинку схемы он идёт: по выделенному
 * слову видно, за какой период проценты.
 */
export function DiagramPeriodSwitch({
  layout,
  links,
  period,
  onPeriod,
}: {
  layout: DiagramLayout;
  links: readonly ConceptNeedLink[] | undefined;
  period: NeedPeriod;
  onPeriod: (period: NeedPeriod) => void;
}) {
  if (!hasNeedRatings(links)) return null;
  const { circle, titleY } = layout;
  return (
    <div
      role="group"
      aria-label="Период оценок потребностей"
      data-need-periods
      style={{
        position: 'absolute',
        left: circle.cx - circle.r,
        width: 2 * circle.r,
        top: titleY - ABOVE_TITLE - HIT / 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-sub)',
      }}
    >
      {NEED_PERIODS.map((p, i) => (
        <Fragment key={p}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            aria-pressed={p === period}
            onClick={() => onPeriod(p)}
            style={word(p === period)}
          >
            {NEED_PERIOD_LABEL[p]}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
