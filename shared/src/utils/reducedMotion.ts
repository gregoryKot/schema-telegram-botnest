// Нейроинклюзивность (волна 1): сниженная анимация.
// WCAG 2.3.3 Animation from Interactions — анимации, конфетти и переходы
// можно отключить. Эффективное значение = ручной выбор пользователя ИЛИ
// системная настройка prefers-reduced-motion.
//
// Хранение локальное (per-device); хранилище недоступно — «как в системе»: бросок
// при загрузке AppShell давал белый экран (E10). CSS — html[data-reduce-motion="1"].
import { readLocal, removeLocal, writeLocal } from './safeLocalStorage';

export type MotionPref = 'system' | 'reduced';

const KEY = 'reduce_motion';

/** Чистая логика: включена ли сниженная анимация при данных вводных. */
export function isReducedFrom(
  pref: MotionPref,
  systemReduced: boolean,
): boolean {
  return pref === 'reduced' || systemReduced;
}

/** Чистая логика: разбор сырого значения localStorage. */
export function parseMotionPref(raw: string | null): MotionPref {
  return raw === '1' ? 'reduced' : 'system';
}

export function systemPrefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function getMotionPref(): MotionPref {
  return parseMotionPref(readLocal(KEY));
}

/** Итог для JS-анимаций (canvas-конфетти и т.п.). CSS сам смотрит на атрибут/media. */
export function isReducedMotion(): boolean {
  return isReducedFrom(getMotionPref(), systemPrefersReducedMotion());
}

/** Проставить html[data-reduce-motion] по текущему выбору. Вызывать на старте. */
export function syncMotionAttr(): void {
  const el = document.documentElement;
  if (getMotionPref() === 'reduced') el.setAttribute('data-reduce-motion', '1');
  else el.removeAttribute('data-reduce-motion');
}

export function setMotionPref(pref: MotionPref): void {
  if (pref === 'reduced') writeLocal(KEY, '1');
  else removeLocal(KEY);
  syncMotionAttr();
}

export function toggleMotionPref(): MotionPref {
  const next: MotionPref = getMotionPref() === 'reduced' ? 'system' : 'reduced';
  setMotionPref(next);
  return next;
}
