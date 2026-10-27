// Оттенки редизайна кабинетов 2026-10 — единственное место, где сущность
// (домен схем, группа режимов, потребность, тип записи) получает цвет.
// Компонент кладёт число в `--h` и берёт класс .tone-* из styles/cabinet.css;
// L/C у всей гаммы общие, так что домены различаются только оттенком.
import type { CSSProperties } from 'react';
import type { NeedId } from '../../../shared/src/needs/types';

/** Домены схем → hue (порядок SCHEMA_DOMAINS, D1…D5). */
export const DOMAIN_HUE: Record<string, number> = {
  rejection: 28,
  autonomy: 70,
  limits: 135,
  other_directed: 240,
  vigilance: 310,
};

/** Группы режимов (id из MODE_GROUPS). Три копинговые — один «копинговый» тон. */
export const MODE_GROUP_HUE: Record<string, number> = {
  child: 28,
  critic: 310,
  coping_surrender: 240,
  coping_avoidance: 240,
  coping_overcompensation: 240,
  healthy: 145,
};

/** Потребность → hue домена, который она питает. */
export const NEED_HUE: Record<NeedId, number> = {
  attachment: 28,
  autonomy: 70,
  limits: 135,
  expression: 240,
  play: 310,
};

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
