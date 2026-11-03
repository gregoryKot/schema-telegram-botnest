// Оттенки редизайна кабинетов 2026-10. Таблицы домен/группа режимов/потребность
// и toneHex живут в shared/src/theme/entityHue.ts (одна на сайт и мини-апп),
// здесь реэкспорт; тип записи, раздел и нейтральный тон — локально.
// Компонент кладёт число в `--h` и берёт класс .tone-* из styles/cabinet.css;
// L/C у всей гаммы общие, так что домены различаются только оттенком.
import type { CSSProperties } from 'react';

export { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE, toneHex } from '../../../shared/src/theme/entityHue';

/** Тип записи дневника. */
export const DIARY_HUE: Record<'schema' | 'mode' | 'gratitude', number> = {
  schema: 28,
  mode: 240,
  gratitude: 145,
};

/** Разделы кабинета клиента — цветной квадрат в сайдбаре. */
export const SECTION_HUE: Record<'today' | 'diary' | 'more' | 'schemas' | 'practice' | 'profile', number> = {
  today: 28,
  diary: 240,
  more: 70,
  schemas: 310,
  practice: 145,
  profile: 70,
};

const NEUTRAL_HUE = 70;

/** Стиль с `--h` для элемента с классом .tone-* / .ds-avatar. */
export function hueStyle(hue: number | undefined): CSSProperties {
  return { '--h': hue ?? NEUTRAL_HUE } as CSSProperties;
}

/** Стабильный оттенок аватара клиента по id: один клиент — всегда один цвет. */
export function clientHue(id: number | string): number {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = [240, 28, 145, 310, 70, 190];
  return palette[h % palette.length];
}

/** Уровень индекса дня: ≥7 — ok, ≥5 — warn, ниже — err, нет данных — none. */
export type IndexLevel = 'ok' | 'warn' | 'err' | 'none';
export function indexLevel(v: number | null | undefined): IndexLevel {
  if (v == null || Number.isNaN(v)) return 'none';
  if (v >= 7) return 'ok';
  if (v >= 5) return 'warn';
  return 'err';
}
