import { hueStyle } from '../lib/tone';
import { haptic } from '../haptic';
import { RATING_WORDS, wordForValue } from '../../../shared/src/needs/ratingWords';

/** NeedScale variant="words": пять ответов во всю ширину, справа пять «пипсов» — закрашено столько, сколько порядковый номер ответа. */
export function WordScale({ value, hue, onChange, label, yesterday }: {
  value: number | undefined;
  hue: number;
  onChange: (value: number) => void;
  label: string;
  yesterday?: number;
}) {
  const current = wordForValue(value)?.value;
  const yesterdayWord = wordForValue(yesterday)?.value;
  return (
    <div role="group" aria-label={label} className="ns-words" style={hueStyle(hue)}>
      {RATING_WORDS.map((w, i) => (
        <button
          key={w.value}
          type="button"
          aria-label={`${w.label} — ${w.value} из 10`}
          aria-pressed={w.value === current}
          className={'ns-word' + (w.value === current ? ' is-selected' : '')}
          onClick={() => { haptic.tap(); onChange(w.value); }}
        >
          <span>{w.label}</span>
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
