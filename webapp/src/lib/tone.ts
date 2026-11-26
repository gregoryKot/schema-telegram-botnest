// Оттенки редизайна кабинетов 2026-10. Таблицы домен/группа режимов/потребность
// живут в shared/src/theme/entityHue.ts (там же toneHex для готового цвета),
// здесь реэкспорт; тип записи и нейтральный тон — локально. Разделы меню — знаками
// своей сущности (components/appShell/navLook.ts), а не цветными квадратами.
// Компонент кладёт число в `--h` и берёт класс .tone-* из styles/cabinet.css;
// L/C у всей гаммы общие, так что домены различаются только оттенком.
import type { CSSProperties } from 'react';

export { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE } from '../../../shared/src/theme/entityHue';

/** Тип записи дневника. */
export const DIARY_HUE: Record<'schema' | 'mode', number> = {
  schema: 28,
  mode: 240,
};

const NEUTRAL_HUE = 70;

/** Стиль с `--h` для элемента с классом .tone-*; без оттенка — нейтральный. */
export function hueStyle(hue: number | undefined): CSSProperties {
  return { '--h': hue ?? NEUTRAL_HUE } as unknown as CSSProperties;
}

/** Уровень индекса дня: ≥7 — ok, ≥5 — warn, ниже — err, нет данных — none. */
export type IndexLevel = 'ok' | 'warn' | 'err' | 'none';
export function indexLevel(v: number | null | undefined): IndexLevel {
  if (v == null || Number.isNaN(v)) return 'none';
  if (v >= 7) return 'ok';
  if (v >= 5) return 'warn';
  return 'err';
}
