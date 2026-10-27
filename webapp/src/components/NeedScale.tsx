import '../styles/need-scale.css';
import { hueStyle } from '../lib/tone';
import { NEED_SCALE_MAX, isSegmentFilled } from './needScaleModel';
import { haptic } from '../haptic';
import { WordScale } from './WordScale';

// Единственный ввод оценки потребности. Два вида одной механики:
//  - 'words' (клиентский трекер и лист потребности, WordScale): пять ответов
//    словами «Совсем нет … Полностью», пишут 2/4/6/8/10; старая оценка 1–10
//    подсвечивает ближайшее слово (shared/needs/ratingWords);
//  - 'ten' (по умолчанию): десять сегментов-кнопок 0–10.
// Каждая кнопка нативная с aria-label («N из 10» / «Слово — N из 10»), так что
// шкала доступна с клавиатуры и экранным читалкам без дополнительной обвязки.

interface Props {
  value: number | undefined;
  hue: number;
  onChange: (value: number) => void;
  /** Название потребности — подпись группы для экранных читалок. */
  label: string;
  size?: 'md' | 'lg';
  /** Вчерашняя оценка — точка под сегментом (паритет с NeedRatingBar мини-аппа, В10 аудита 2026-08); в 'words' — пометка «вчера» на слове. */
  yesterday?: number;
  variant?: 'ten' | 'words'; sublabels?: (string | undefined)[]; // sublabels — только 'words': якоря «что означает ответ»
}

const SEGMENTS = Array.from({ length: NEED_SCALE_MAX }, (_, i) => i + 1);

export function NeedScale({ value, hue, onChange, label, size = 'md', yesterday, variant = 'ten', sublabels }: Props) {
  if (variant === 'words') return <WordScale value={value} hue={hue} onChange={onChange} label={label} yesterday={yesterday} sublabels={sublabels} />;
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
