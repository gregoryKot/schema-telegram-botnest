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

// Разбор/сериализация — общий примитив stringArrayStorage (пустой список =
// «ничего не скрыто»). Реэкспорт под прежними именами — API и тесты те же.
export {
  parseStringArray as parseHiddenActions,
  serializeStringArray as serializeHiddenActions,
  readStringArray as getHiddenActions,
} from './stringArrayStorage';
import { readStringArray, writeStringArray } from './stringArrayStorage';

/** Скрывает/возвращает один пункт по id, сохраняя остальные скрытые как есть. */
export function setActionHidden(
  key: string,
  id: string,
  hidden: boolean,
): void {
  const current = readStringArray(key);
  const next = hidden
    ? current.includes(id)
      ? current
      : [...current, id]
    : current.filter((x) => x !== id);
  writeStringArray(key, next);
}

export function isActionHidden(key: string, id: string): boolean {
  return readStringArray(key).includes(id);
}
