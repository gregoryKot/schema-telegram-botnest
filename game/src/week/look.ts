// Какой кадр показать: анимация Саши по состоянию бега и кадр стопки по её высоте. Чистая логика — арт подставляет сцена.
import { GRID } from '../gridScale';

export interface SashaView {
  frozen: boolean;   // ПАУЗА удержана до остановки
  resting: boolean;  // сил нет — плетётся
  sitting?: boolean; // …а первую секунду сидит
  dashing: boolean;
  onGround: boolean;
  vy: number;
  phone: boolean;
  speed: number;     // px/с по горизонтали
  load: number;      // чужое в рюкзаке
}
export type SashaLook = { anim: string } | { sheet: string; frame: number };

/** Саша всегда в одной позе из листа: остановка важнее усталости, усталость — рывка, полёт — шага. */
export function sashaLook(v: SashaView): SashaLook {
  const heavy = v.load > 0 ? '_heavy' : '';
  if (v.frozen) return { sheet: `wk_sasha_still${heavy}`, frame: 0 };
  if (v.sitting) return { sheet: `wk_sasha_still${heavy}`, frame: 1 };
  if (v.resting) return { anim: `wk-trudge${heavy}` };
  if (v.dashing) return { anim: `wk-dash${heavy}` };
  if (!v.onGround) return { sheet: `wk_sasha_air${heavy}`, frame: v.vy < 0 ? 0 : 1 };
  if (v.phone) return { anim: `wk-phone${heavy}` };
  if (v.speed < 8) return { anim: `wk-idle${heavy}` };
  return { anim: `${v.speed <= 100 ? 'wk-walk' : 'wk-run'}${heavy}` };
}

// высоты стопок в листе wk_piles, px арта (game/art/week_props.py — PILE_H)
export const PILE_H = [20, 23, 25, 28, 53, 85];
/** Кадр стопки: самая низкая из нарисованных, что не ниже преграды h (в px экрана). */
export function pileFrame(h: number): number {
  const i = PILE_H.findIndex(p => p * GRID >= h);
  return i < 0 ? PILE_H.length - 1 : i;
}

/** Какой кусок экрана [left, right) занимает зона мира [from, to) при прокрутке scrollX; null — зоны в кадре нет. */
export function zoneOnScreen(from: number, to: number, scrollX: number, viewW: number): { left: number; width: number; tileX: number } | null {
  const left = Math.max(0, Math.round(from - scrollX)), right = Math.min(viewW, Math.round(to - scrollX));
  if (right <= left) return null;
  return { left, width: right - left, tileX: (left + Math.round(scrollX) - from) / GRID };
}
