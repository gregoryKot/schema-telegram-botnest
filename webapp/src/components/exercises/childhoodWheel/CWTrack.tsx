import { hueStyle } from '../../../lib/tone';
import { useRatingSlider } from '../../../../../shared/src/childhoodWheel/useRatingSlider';

/** Ползунок 0–10. `value` нет — потребность ещё не оценена: ни заливки, ни бегунка.
 * Указатель и клавиатура (стрелки, Home/End, Enter/пробел) — useRatingSlider. */
export function CWTrack({ value, onChange, hue, label }: {
  value: number | undefined;
  onChange: (v: number) => void;
  hue: number;
  /** Доступное имя ползунка — название потребности. */
  label: string;
}) {
  const slider = useRatingSlider({ value, onChange, label });
  const pct = (value ?? 0) * 10;
  return (
    <div {...slider} className="ex2-cw-track" style={hueStyle(hue)}>
      <div className="ex2-cw-line">
        <div className="ex2-cw-fill" style={{ width: pct + '%' }} />
        {[0, 25, 50, 75, 100].map((p) => (
          <div key={p} className="ex2-cw-pip" style={{ left: p + '%' }} />
        ))}
      </div>
      {value !== undefined && <div className="ex2-cw-thumb" style={{ left: pct + '%' }} />}
    </div>
  );
}
