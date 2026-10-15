import type { ComponentPropsWithRef } from 'react';
import { CharCounter } from './CharCounter';

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
  return (
    <>
      <textarea {...rest} value={value} maxLength={max} />
      <CharCounter length={value.length} max={max} always={alwaysCount} />
    </>
  );
}
