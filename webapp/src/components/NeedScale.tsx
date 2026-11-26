import '../styles/need-scale.css';
import { hueStyle } from '../lib/tone';
import { haptic } from '../haptic';
import { RATING_WORDS, wordForValue } from '../../../shared/src/needs/ratingWords';
import { needDataStyle } from './needDataColor';

/** Единственный ввод оценки потребности (трекер, лист потребности): пять ответов словами во всю ширину, пишут 2/4/6/8/10 (shared/needs/ratingWords); справа пять «пипсов» цветом данных потребности (--nd). */
export function NeedScale({ value, hue, needId, onChange, label, yesterday, sublabels }: {
  value: number | undefined;
  hue: number;
  needId: string;
  onChange: (value: number) => void;
  label: string;
  yesterday?: number;
  /** Подпись под словом (что означает ответ) — по индексу слова; undefined — без подписи. */
  sublabels?: (string | undefined)[];
}) {
  const current = wordForValue(value)?.value;
  const yesterdayWord = wordForValue(yesterday)?.value;
  return (
    <div role="group" aria-label={label} className="ns-words" style={{ ...hueStyle(hue), ...needDataStyle(needId) }}>
      {RATING_WORDS.map((w, i) => (
        <button
          key={w.value}
          type="button"
          aria-label={`${w.label} — ${w.value} из 10`}
          aria-pressed={w.value === current}
          className={'ns-word' + (w.value === current ? ' is-selected' : '')}
          onClick={() => { haptic.tap(); onChange(w.value); }}
        >
          <span className="ns-word-main">
            <span>{w.label}</span>
            {sublabels?.[i] && <span className="ns-word-sub">{sublabels[i]}</span>}
          </span>
          <span className="ns-word-end">
            {w.value === yesterdayWord && <span className="ns-word-y">вчера</span>}
            <span className="ns-pips" aria-hidden="true">
              {RATING_WORDS.map((p, j) => (
                <i key={p.value} className={'ns-pip' + (j <= i ? ' is-on' : '')} />
              ))}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
