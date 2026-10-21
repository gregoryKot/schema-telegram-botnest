import { NeedScale } from '../NeedScale';
import { haptic } from '../../haptic';
import { NEED_SCALE_MAX } from '../needScaleModel';
import { stepNeedValue } from './needStep';
import type { DeltaView } from '../../sections/today/model';
import '../../styles/sheet-tracker-mobile.css';

/** Оценка потребности на телефоне: крупное значение, шкала-полоска, «−» / «+» (паритет с мини-аппом). */
export function MobileScale({
  value,
  hue,
  label,
  yesterday,
  delta,
  onChange,
}: {
  value: number;
  hue: number;
  label: string;
  yesterday?: number;
  delta?: DeltaView | null;
  onChange: (v: number) => void;
}) {
  const step = (dir: 1 | -1) => {
    const next = stepNeedValue(value, dir);
    if (next === value) return;
    haptic.tap();
    onChange(next);
  };
  return (
    <div className="tkm-scale">
      <div className="tkm-readout" aria-live="polite">
        <span className={'ds-num tkm-num' + (value > 0 ? ' tone-text' : ' is-empty')}>{value > 0 ? value : '—'}</span>
        {value > 0 && <span className="tkm-max">/10</span>}
        {value > 0 && delta && (
          <span className={'tk2-delta ' + (delta.up ? 'is-up' : 'is-down')}>вчера {delta.text}</span>
        )}
      </div>
      <NeedScale value={value > 0 ? value : undefined} hue={hue} label={label} size="lg" yesterday={yesterday} onChange={onChange} />
      <div className="tkm-ends">
        <span>мало</span>
        <span>много</span>
      </div>
      <div className="tkm-stepper">
        <button type="button" className="tkm-round" aria-label="Меньше" disabled={value <= 1} onClick={() => step(-1)}>
          −
        </button>
        <span className="ds-label">тап по шкале</span>
        <button type="button" className="tkm-round" aria-label="Больше" disabled={value >= NEED_SCALE_MAX} onClick={() => step(1)}>
          +
        </button>
      </div>
    </div>
  );
}
