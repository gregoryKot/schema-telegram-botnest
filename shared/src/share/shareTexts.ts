// Тексты для шаринга — чистые билдеры (тесты в schema-miniapp/src/share).
// Все формулировки от 1-го лица или безличные: не зависят ни от формы
// обращения (ты/вы), ни от рода пользователя (никаких «получил/получила»).
// link — ссылка на бота (botShortUrl конкретного фронтенда).
import { pluralDays } from '../utils/celebrationText';

export function pluralEntries(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'запись';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return 'записи';
  return 'записей';
}

export function achievementShareText(
  emoji: string,
  title: string,
  link: string,
): string {
  return `${emoji} Новое достижение — «${title}»!\n\nВеду дневник потребностей. ${link}`;
}

export function streakShareText(streak: number, link: string): string {
  return `🔥 ${streak} ${pluralDays(streak)} подряд в дневнике потребностей!\n\nОтслеживаю своё состояние каждый день. ${link}`;
}

export function schemaShareText(name: string, link: string): string {
  return `📖 Изучаю схему «${name}» в схема-терапии.\n\n${link}`;
}

export function diaryShareText(
  title: string,
  emoji: string,
  count: number,
  since: string | null,
  link: string,
): string {
  const sinceStr = since ? ` с ${since}` : '';
  return `${emoji} ${title}: ${count} ${pluralEntries(count)}${sinceStr}.\n\n${link}`;
}
