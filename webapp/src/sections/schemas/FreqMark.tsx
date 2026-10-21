import { dayWord, freqHint } from '../../../../shared/src/pattern/weekPatternText';
import { SUMMARY_WINDOW_DAYS, type WeekPatternKind } from '../../../../shared/src/pattern/patternsSummary';

/**
 * Недельная частота рядом с чипом схемы/режима: полоска + «N дн.» словами.
 * Нулевая частота не рисуется вовсе (анти-стыд: тишина — не провал, квоты «/7» нет).
 * Одна механика на схемы и режимы.
 */
export function FreqMark({ freq }: { freq: number }) {
  if (freq <= 0) return null;
  const w = 8 + Math.round((Math.min(freq, SUMMARY_WINDOW_DAYS) / SUMMARY_WINDOW_DAYS) * 30);
  return (
    <span className="cs-freq">
      <i className="cs-freq-bar tone-fill" style={{ width: w }} aria-hidden />
      <span>{freq} {dayWord(freq)}</span>
    </span>
  );
}

/** Подсказка к полоскам — один раз на блок, когда хоть у кого-то частота > 0. */
export function FreqHint({ kind, freq }: { kind: WeekPatternKind; freq: Record<string, number> }) {
  if (!Object.values(freq).some(n => n > 0)) return null;
  return <p className="cs-hint">{freqHint(kind)}</p>;
}
