// Знаки пунктов меню (docs/design/APP_2026-11.md, «Меню, ⌘K, объединение»): язык знаков — навигация,
// а не украшение. Раздел клиента берёт знак своей сущности ENTITY_LOOK; ключи — литералами (таблицу
// вида главный чанк не тянет), сверка с ENTITY_LOOK — navLook.test.ts. Одна таблица на развёрнутое
// меню, свёрнутую полоску и нижнюю панель телефона (до 2026-11 у кабинета их было три копии).
import type { EntityId } from '../../../../shared/src/theme/entityLook';
import { LIST_TASKS_PATH } from '../therapist/clientTabRoute';
import type { NavSignKey } from './NavSign';
import type { Section } from './navigation';

/** Раздел клиента → сущность и её знак: Сегодня — трекер, Записи — дневник, Практики — дыхание,
 *  Мои паттерны — схемы, Профиль — профиль, Ещё — настройки. */
export const SECTION_LOOK: Record<Section, { entity: EntityId; sign: NavSignKey }> = {
  today: { entity: 'tracker', sign: 'strokes' },
  diary: { entity: 'diary', sign: 'pebbles' },
  practice: { entity: 'breathing', sign: 'breath' },
  schemas: { entity: 'schemas', sign: 'layers' },
  profile: { entity: 'profile', sign: 'leaf' },
  more: { entity: 'settings', sign: 'beads' },
};

export interface TherapistNavItem {
  to: string;
  /** Подпись в меню компьютера; `short` — в нижней панели телефона, где места меньше. */
  label: string;
  short?: string;
  sign: NavSignKey;
  /** Горит только на своём адресе: «Все клиенты» не горит на доске «Задания» (/cabinet/tasks). */
  end?: boolean;
}

/** Кабинет терапевта: Сегодня — Talk (встречи), Справочник — Layers, доска «Задания» — Check
 *  (решение 9: свой пункт меню вместо переключателя на «Клиентах»), клиенты — Cluster. */
export const THERAPIST_NAV = {
  today: { to: '/cabinet/today', label: 'Сегодня', sign: 'talk' },
  guide: { to: '/cabinet/guide', label: 'Справочник', sign: 'layers' },
  tasks: { to: LIST_TASKS_PATH, label: 'Задания', sign: 'check' },
  clients: { to: '/cabinet', label: 'Все клиенты', short: 'Клиенты', sign: 'cluster', end: true },
} as const satisfies Record<string, TherapistNavItem>;
