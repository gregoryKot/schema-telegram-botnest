// Чистые утилиты навигации/истории AppShell — вынесены из AppShell.tsx
// (правило №10). sectionFromPath — своя (по разделам конкретно этого
// фронтенда); fillHistoryGaps — общая с мини-аппом, поэтому не копия,
// а ре-экспорт единственной реализации из shared (правило №3, jscpd-свип
// 2026-08: копия здесь и в schema-miniapp/utils/todayConstants.ts была
// найдена храповиком дублей).
export { fillHistoryGaps } from '../../../../shared/src/utils/todayConstants';

export type Section = 'today' | 'diary' | 'more' | 'schemas' | 'profile' | 'practice';

export function sectionFromPath(path: string): Section {
  const seg = path.split('/').filter(Boolean)[0] ?? 'today';
  if (['today','diary','more','schemas','profile','practice'].includes(seg)) return seg as Section;
  // Legacy redirects
  if (seg === 'help' || seg === 'exercises') return 'practice';
  return 'today';
}

/** Пункт нижней навигации, под которым лежит раздел: «Практики», «Паттерны» и
 *  «Профиль» открываются из «Ещё», поэтому горит «Ещё» (QA 2026-11, C-З8). */
export function navItemOf(path: string): Section {
  const s = sectionFromPath(path);
  return s === 'practice' || s === 'schemas' || s === 'profile' ? 'more' : s;
}

// ── Открытие и закрытие карточки клиента кабинета (QA 2026-11, T-12, T-13) ──────
// Карточка — отдельный адрес /cabinet/<id>; список — /cabinet. Прямой вход по
// ссылке и «Все клиенты» раньше пушили лишние записи истории.
export interface ClientRoute { to: string; state?: { fromList: true } }

/** Куда перейти, открывая карточку; null — уже на ней (прямой вход, перечитывание URL). */
export function openClientRoute(pathname: string, id: string | number): ClientRoute | null {
  const to = '/cabinet/' + id;
  if (pathname === to) return null;
  // Метка «пришли из списка» нужна кнопке «Все клиенты»: вернуться записью истории.
  return pathname === '/cabinet' ? { to, state: { fromList: true } } : { to };
}

/** «← Все клиенты»: из списка пришли — шаг назад (позиция списка сохраняется), иначе — на список. */
export function leaveClientTarget(locationState: unknown): -1 | '/cabinet' {
  return (locationState as { fromList?: boolean } | null)?.fromList ? -1 : '/cabinet';
}
