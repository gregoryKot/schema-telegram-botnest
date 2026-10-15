import type { ComponentPropsWithRef } from 'react';
import { CharCounter } from './CharCounter';
import { charCounterState } from '../limits/textLimits';

// Поле ввода с пределом длины сервера: `maxLength` + счётчик остатка под ним.
// Один компонент на оба фронта вместо `maxLength` и самодельного «N/500» в
// каждом экране (правило «одна механика — один компонент»). Предел берётся
// из `shared/src/limits/textLimits.ts` — тот же, что `@MaxLength` в DTO.
//
// `ref` пробрасывается как обычный проп (React 19). Остальные пропсы уходят
// в `<textarea>` как есть, внешний вид остаётся за вызывающим.
export function LimitedTextarea({
  max,
  value,
  alwaysCount,
  ...rest
}: {
  max: number;
  value: string;
  /** Счётчик «N/предел» виден всегда (короткие поля). */
  alwaysCount?: boolean;
} & Omit<ComponentPropsWithRef<'textarea'>, 'value' | 'maxLength'>) {
  // Счётчик привязан к полю через aria-describedby, пока он на экране: экранный
  // читатель слышит предел при фокусе, а не только через aria-live на границе.
  const counterId =
    rest.id && charCounterState(value.length, max, alwaysCount)
      ? `${rest.id}-limit`
      : undefined;
  const describedBy =
    [rest['aria-describedby'], counterId].filter(Boolean).join(' ') ||
    undefined;
  return (
    <>
      <textarea
        {...rest}
        aria-describedby={describedBy}
        value={value}
        maxLength={max}
      />
      <CharCounter
        length={value.length}
        max={max}
        always={alwaysCount}
        id={counterId}
      />
    </>
  );
}
