import '../styles/need-scale.css';
import { hueStyle } from '../lib/tone';
import { NEED_SCALE_MAX, isSegmentFilled } from './needScaleModel';
import { haptic } from '../haptic';

// Единственный ввод оценки потребности 0–10: десять сегментов-кнопок.
// Используется на «Сегодня» и в листе оценки потребности (NeedTodaySheet).
// Каждый сегмент — нативная кнопка с aria-label «N из 10», так что шкала
// доступна с клавиатуры и экранным читалкам без дополнительной обвязки.

interface Props {
  value: number | undefined;
  hue: number;
  onChange: (value: number) => void;
  /** Название потребности — подпись группы для экранных читалок. */
  label: string;
  size?: 'md' | 'lg';
  /** Вчерашняя оценка — точка под сегментом (паритет с NeedRatingBar мини-аппа, В10 аудита 2026-08). */
  yesterday?: number;
}

const SEGMENTS = Array.from({ length: NEED_SCALE_MAX }, (_, i) => i + 1);

export function NeedScale({ value, hue, onChange, label, size = 'md', yesterday }: Props) {
  return (
    <div role="group" aria-label={label} className={`ns-scale ns-scale--${size}`} style={hueStyle(hue)}>
      {SEGMENTS.map(n => (
        <button
          key={n}
          type="button"
          aria-label={`${n} из 10`}
          aria-pressed={n === value}
          className={'ns-seg' + (isSegmentFilled(n, value) ? ' is-on tone-fill' : '') + (n === yesterday ? ' is-yesterday' : '')}
          onClick={() => { haptic.tap(); onChange(n); }}
        />
      ))}
    </div>
  );
}
