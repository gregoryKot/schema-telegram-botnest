import type { Section } from './navigation';

type NavItem = { id: Section; label: string };

// Нижняя панель телефона — три вкладки (редизайн 2026-10, docs/design/CLIENT_SIMPLE_2026-10.md):
// «Практики», «Мои паттерны» и «Профиль» открываются из «Ещё» и по прямому URL.
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'diary', label: 'Записи' },
  { id: 'more', label: 'Ещё' },
];

// Меню слева на ≥768 (#925): на компьютере места хватает, и разделы не прячутся в «Ещё».
// Путь пункта — '/' + id, как в appRoutes (App.tsx). Сайдбар на телефоне скрыт (index.css).
export const DESKTOP_NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'diary', label: 'Записи' },
  { id: 'practice', label: 'Практики' },
  { id: 'schemas', label: 'Мои паттерны' },
  { id: 'profile', label: 'Профиль' },
  { id: 'more', label: 'Ещё' },
];
