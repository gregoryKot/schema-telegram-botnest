import { NeedScale } from '../NeedScale';
import { hueStyle } from '../../lib/tone';
import type { DeltaView } from '../../sections/today/model';

/** Оценка потребности в трекере: крупное число, единственная шкала NeedScale, дельта к вчера. */
export function NeedScalePanel({
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
  return (
    <div className="tk2-scale-wrap">
      {value > 0 && (
        <div className="tk2-readout">
          <span className="ds-num tone-text" style={hueStyle(hue)}>{value}</span>
          <span className="tk2-readout-max">/10</span>
          {delta && (
            <span className={'tk2-delta ' + (delta.up ? 'is-up' : 'is-down')}>вчера {delta.text}</span>
          )}
        </div>
      )}
      <NeedScale value={value > 0 ? value : undefined} hue={hue} label={label} size="lg" yesterday={yesterday} onChange={onChange} />
      <div className="ds-label tk2-ticks">
        <span>низко</span>
        <span>средне</span>
        <span>хорошо</span>
      </div>
      {value === 0 && <div className="ds-label tk2-empty">ни одна цифра не выбрана</div>}
    </div>
  );
}
