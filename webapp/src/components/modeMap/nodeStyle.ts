import type { ModeMapNode } from '../../api';

// Данные ноды карты режимов — тот же объект, что хранится в ModeMapNode.data.
export type ModeNodeData = ModeMapNode['data'];

export function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g);
  return m ? `${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)}` : null;
}

// Accepts both a CSS token (e.g. 'var(--c-teal)') and a legacy stored hex
// ('#7aa3d4' from older saved maps). Tokens use color-mix so the fill stays
// theme-aware; hexes keep the old rgba path for backward compatibility.
export function fillColor(color: string, filled?: boolean, fillFull?: boolean) {
  const op = fillFull ? 0.88 : filled ? 0.22 : 0.08;
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb},${op})` : `rgba(var(--fg-rgb),${op})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(op * 100)}%, transparent)`;
}

// Contour thickness + text size — minimal per-node settings
const STROKE_PX: Record<string, number> = { thin: 1.5, normal: 2.5, bold: 4 };
export const strokePx = (d: ModeNodeData) => STROKE_PX[d.strokeWidth ?? 'normal'] ?? 2.5;
const FONT_PX: Record<string, number> = { sm: 11.5, md: 13.5, lg: 16.5 };
export const fontPx = (d: ModeNodeData) => FONT_PX[d.fontSize ?? 'md'] ?? 13.5;
