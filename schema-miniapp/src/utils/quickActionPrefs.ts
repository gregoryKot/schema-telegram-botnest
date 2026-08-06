// Скрытие пунктов реестра быстрых действий (utils/quickActions.ts). Модель —
// opt-out: хранится список СКРЫТЫХ id, всё, чего в списке нет, — видно. Так
// новое действие в реестре появляется на устройстве само, без миграции
// (симметрично todayFocus.ts — скрытие тоже per-device в localStorage).
//
// Generic по ключу: два ключа-поверхности («плюс» и «Инструменты», второй
// понадобится отдельной задаче) используют одни и те же parse/get/set —
// правило «одна механика — один компонент».

export type QuickActionSurface = 'plus' | 'tools';

export const PLUS_ACTIONS_HIDDEN_KEY = 'quick_actions_hidden_plus';
export const TOOLS_ACTIONS_HIDDEN_KEY = 'quick_actions_hidden_tools';

/** Чистая логика: разбор сырого значения localStorage. Битый JSON/не-массив
 * /не-строки внутри → пустой набор (значит «ничего не скрыто»). */
export function parseHiddenActions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export function serializeHiddenActions(ids: string[]): string {
  return JSON.stringify(ids);
}

export function getHiddenActions(key: string): string[] {
  return parseHiddenActions(localStorage.getItem(key));
}

/** Скрывает/возвращает один пункт по id, сохраняя остальные скрытые как есть. */
export function setActionHidden(key: string, id: string, hidden: boolean): void {
  const current = getHiddenActions(key);
  const next = hidden
    ? current.includes(id)
      ? current
      : [...current, id]
    : current.filter((x) => x !== id);
  if (next.length === 0) localStorage.removeItem(key);
  else localStorage.setItem(key, serializeHiddenActions(next));
}

export function isActionHidden(key: string, id: string): boolean {
  return getHiddenActions(key).includes(id);
}
