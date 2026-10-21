import { pluralRu } from '../utils/pluralRu';
import { fmtAgo } from '../utils/format';

// Момент «из будущего» (часы клиента отстают от сервера) не должен давать «-1 дн. назад».
function ago(d: string): string {
  const t = Date.parse(d);
  return fmtAgo(
    Number.isNaN(t) || t <= Date.now() ? d : new Date().toISOString(),
  );
}

/**
 * Мета-строка дневника в хабе: «12 записей · сегодня» либо «Пока пусто».
 * Чистая функция — на чистом аккаунте вместо цифр никогда не подставляется
 * заглушка (правило «никаких хардкод-заглушек»). Источник — реальные записи.
 */
export function diaryRowMeta(count: number, lastDate?: string | null): string {
  if (count <= 0) return 'Пока пусто';
  const entries = `${count} ${pluralRu(count, 'запись', 'записи', 'записей')}`;
  return lastDate ? `${entries} · ${ago(lastDate)}` : entries;
}

/** Строка трекера в хабе: «Последняя отметка · вчера» либо «Пока пусто». */
export function trackerRowMeta(lastNeedsDate?: string | null): string {
  return lastNeedsDate
    ? `Последняя отметка · ${ago(lastNeedsDate)}`
    : 'Пока пусто';
}
