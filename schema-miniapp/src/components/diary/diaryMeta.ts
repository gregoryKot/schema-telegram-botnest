import { plural } from '../../sections/today/helpers';
import { fmtAgo } from '../../utils/format';

/**
 * Мета-строка дневника в хабе: «12 записей · сегодня» либо «Пока пусто».
 * Чистая функция — чтобы состояние пустого аккаунта было под тестом и вместо
 * реальных цифр никогда не подставилась заглушка (правило «никаких
 * хардкод-заглушек»).
 */
export function diaryRowMeta(count: number, lastDate?: string): string {
  if (count <= 0) return 'Пока пусто';
  const entries = `${count} ${plural(count, 'запись', 'записи', 'записей')}`;
  return lastDate ? `${entries} · ${fmtAgo(lastDate)}` : entries;
}
