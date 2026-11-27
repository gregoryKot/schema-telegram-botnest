// Знаки пунктов меню (docs/design/APP_2026-11.md, «Меню, ⌘K, объединение»): язык знаков — навигация, а не
// украшение. Раздел клиента берёт знак своей сущности из ENTITY_LOOK; одна таблица на меню, полоску и панель телефона.
import { ENTITY_LOOK, type EntityId } from '../../../../shared/src/theme/entityLook';
import type { NavSignKey } from './NavSign';
import type { Section } from './navigation';

/** Раздел клиента → сущность и её знак: Сегодня — трекер, Записи — дневник, Практики — дыхание,
 *  Мои паттерны — схемы, Профиль — профиль, Ещё — настройки. */
export const SECTION_LOOK: Record<Section, { entity: EntityId; sign: NavSignKey }> = {
  today: { entity: 'tracker', sign: ENTITY_LOOK.tracker.sign },
  diary: { entity: 'diary', sign: ENTITY_LOOK.diary.sign },
  practice: { entity: 'breathing', sign: ENTITY_LOOK.breathing.sign },
  schemas: { entity: 'schemas', sign: ENTITY_LOOK.schemas.sign },
  profile: { entity: 'profile', sign: ENTITY_LOOK.profile.sign },
  more: { entity: 'settings', sign: ENTITY_LOOK.settings.sign },
};

export interface TherapistNavItem {
  to: string;
  /** Подпись в меню компьютера; `short` — в нижней панели телефона, где места меньше. */
  label: string;
  short?: string;
  sign: NavSignKey;
  /** Горит только на своём адресе: «Все клиенты» не горит в карточке клиента. */
  end?: boolean;
}

/** Кабинет терапевта: Сегодня — Talk (встречи), Справочник — Layers, клиенты — Cluster. */
export const THERAPIST_NAV = {
  today: { to: '/cabinet/today', label: 'Сегодня', sign: 'talk' },
  guide: { to: '/cabinet/guide', label: 'Справочник', sign: 'layers' },
  clients: { to: '/cabinet', label: 'Все клиенты', short: 'Клиенты', sign: 'cluster', end: true },
} as const satisfies Record<string, TherapistNavItem>;
