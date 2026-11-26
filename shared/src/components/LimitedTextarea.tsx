import type { ComponentPropsWithRef } from 'react';
import { CharCounter } from './CharCounter';
import { charCounterState } from '../limits/textLimits';

// Поле ввода с пределом длины сервера: `maxLength` + счётчик остатка под ним.
// Один компонент на оба фронта вместо `maxLength` и самодельного «N/500» в
// каждом экране (правило «одна механика — один компонент»). Предел берётся
// из `shared/src/limits/textLimits.ts` — тот же, что `@MaxLength` в DTO.
// Однострочное поле — `LimitedInput` ниже, с той же проводкой счётчика.
//
// `ref` пробрасывается как обычный проп (React 19). Остальные пропсы уходят
// в `<textarea>` как есть, внешний вид остаётся за вызывающим.

interface LimitProps {
  max: number;
  value: string;
  /** Счётчик «N/предел» виден всегда (короткие поля). */
  alwaysCount?: boolean;
}

// Счётчик привязан к полю через aria-describedby, пока он на экране: экранный
// читатель слышит предел при фокусе, а не только через aria-live на границе.
function limitWiring(
  { max, value, alwaysCount }: LimitProps,
  id: string | undefined,
  ownDescribedBy: string | undefined,
) {
  const counterId =
    id && charCounterState(value.length, max, alwaysCount)
      ? `${id}-limit`
      : undefined;
  const describedBy =
    [ownDescribedBy, counterId].filter(Boolean).join(' ') || undefined;
  const counter = (
    <CharCounter
      length={value.length}
      max={max}
      always={alwaysCount}
      id={counterId}
    />
  );
  return { describedBy, counter };
}

// Свободный текст человека: Вебвизор Метрики на визитке не пишет нажатия в
// поле с меткой `ym-disable-keys` (security#27, гейт
// scripts/check-webvisor-fields.mjs). Метка стоит в самом общем поле, а не у
// каждого вызывающего — новое место с пределом длины защищено сразу; класс
// вызывающего сохраняется. Гейт читает тег буквально, поэтому метка написана
// в каждом теге, а не спрятана в общий объект пропсов.
const withCaller = (className: string | undefined) =>
  className ? ` ${className}` : '';

export function LimitedTextarea({
  max,
  value,
  alwaysCount,
  ...rest
}: LimitProps &
  Omit<ComponentPropsWithRef<'textarea'>, 'value' | 'maxLength'>) {
  const { describedBy, counter } = limitWiring(
    { max, value, alwaysCount },
    rest.id,
    rest['aria-describedby'],
  );
  return (
    <>
      <textarea
        {...rest}
        className={`ym-disable-keys${withCaller(rest.className)}`}
        aria-describedby={describedBy}
        value={value}
        maxLength={max}
      />
      {counter}
    </>
  );
}

/** Однострочный вариант: `<input>` с тем же пределом и счётчиком. */
export function LimitedInput({
  max,
  value,
  alwaysCount,
  ...rest
}: LimitProps & Omit<ComponentPropsWithRef<'input'>, 'value' | 'maxLength'>) {
  const { describedBy, counter } = limitWiring(
    { max, value, alwaysCount },
    rest.id,
    rest['aria-describedby'],
  );
  return (
    <>
      <input
        {...rest}
        className={`ym-disable-keys${withCaller(rest.className)}`}
        aria-describedby={describedBy}
        value={value}
        maxLength={max}
      />
      {counter}
    </>
  );
}
