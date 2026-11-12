import type { CSSProperties } from 'react';
import { NEED_HUE } from '../../../lib/tone';
import { NeedArt } from '../../art/NeedArt';
import { inkVars } from '../../history/needInk';
import { CWTrack } from './CWTrack';
import { NeedExamples } from './NeedExamples';
import type { WheelNeed } from './needs';

/**
 * Строка потребности на шаге оценки: знак потребности, название и оценка Literata в одну строку, ниже во
 * всю ширину — вопрос, ползунок на бумаге потребности (CWTrack: дорожка — бумага NEED_HUE, заливка и
 * бегунок — цвет данных), полюса шкалы и примеры. Ближний к оценке полюс темнее (--text-sub → --text),
 * а не красный и зелёный: «дефицит» — описание, не тревога. `value` нет — «—» и «не оценено».
 */
export function NeedRateRow({ need, value, onChange }: { need: WheelNeed; value: number | undefined; onChange: (v: number) => void }) {
  const style = { '--h': NEED_HUE[need.id], ...inkVars(need.id) } as CSSProperties;
  const v = value ?? 5;
  return (
    <div className="ex2-cw-row" style={style}>
      <span className="pp-row-art ex2-cw-sign" aria-hidden="true"><NeedArt id={need.id} size="row" /></span>
      <div className="ex2-cw-label">{need.label}</div>
      <div className={'ex2-cw-value' + (value === undefined ? ' is-unset' : '')}>
        {value ?? '—'}
        <span>{value === undefined ? ' не оценено' : '/10'}</span>
      </div>
      <div className="ex2-cw-q">{need.question}</div>
      <CWTrack value={value} onChange={onChange} hue={NEED_HUE[need.id]} label={need.label} />
      <div className="ex2-cw-ends">
        <div className={'ex2-cw-end' + (v <= 4 ? ' is-on' : '')}>
          <b>0 – дефицит. </b>
          {need.low}
        </div>
        <div className={'ex2-cw-end' + (v >= 8 ? ' is-on' : '')}>
          <b>10 – насыщение. </b>
          {need.high}
        </div>
      </div>
      <NeedExamples needId={need.id} />
    </div>
  );
}
