import type { CSSProperties } from 'react';
import { colorMix } from '../../utils/colorMix';
import type { ConceptSkin } from './conceptSkin';

/** Цвет сущности для классов сайта: число hue в `--h` (без hue — нейтральный тон). */
export function hueVar(hue: number | undefined): CSSProperties | undefined {
  return hue === undefined ? undefined : ({ '--h': hue } as CSSProperties);
}

/** Классы и стиль чипа: со skin — ds-chip (цвет несёт --h), без — пилюля мини-аппа. */
export function conceptChipLook(
  skin: ConceptSkin | null,
  color: string,
  active: boolean,
  readOnly: boolean,
  hue?: number,
): { className?: string; style?: CSSProperties } {
  if (!skin) return { style: conceptChipStyle(color, active, readOnly) };
  if (readOnly) return { className: skin.tag, style: hueVar(hue) };
  return {
    className: skin.chip + (active ? ' is-on' : ''),
    style: hueVar(hue),
  };
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
