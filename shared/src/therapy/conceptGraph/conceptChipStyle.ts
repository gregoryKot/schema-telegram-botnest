import type { CSSProperties } from 'react';
import { colorMix } from '../../utils/colorMix';

/** Цвет сущности для классов сайта: число hue в `--h`. Без hue `--h` не задаётся — берётся тон
 *  предка, а нет его — запасной нейтральный оттенок в правиле CSS (`var(--h, 70)` у выбранного чипа). */
export function hueVar(hue: number | undefined): CSSProperties | undefined {
  return hue === undefined ? undefined : ({ '--h': hue } as CSSProperties);
}

/** Вид пилюли-переключателя; readOnly — та же пилюля как подпись, без зоны нажатия. */
export function conceptChipStyle(
  color: string,
  active: boolean,
  readOnly: boolean,
): CSSProperties {
  return {
    display: readOnly ? 'inline-block' : undefined,
    minHeight: readOnly ? undefined : 44,
    padding: '5px 12px',
    borderRadius: 'var(--r-20)',
    border: 'none',
    cursor: readOnly ? 'default' : 'pointer',
    background: active ? colorMix(color, 22) : 'rgba(var(--fg-rgb),0.05)',
    boxShadow: active ? `inset 0 0 0 1.5px ${colorMix(color, 60)}` : 'none',
    color: active ? 'var(--text)' : 'var(--text-sub)',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    transition: 'all 0.15s ease',
  };
}
