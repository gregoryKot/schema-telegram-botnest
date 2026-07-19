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

export function modeShareText(name: string, link: string): string {
  return `🎭 Изучаю режим «${name}» в схема-терапии.\n\n${link}`;
}

/** Приглашение в пару: код + deep-link мини-аппа (miniappDeepLink фронта). */
export function pairInviteShareText(code: string, deepLink: string): string {
  return `🤝 Присоединяйся — отслеживаем эмоциональные потребности вместе.\n\nКод пары: ${code}\n${deepLink}`;
}

export function monthShareText(activeDays: number, link: string): string {
  return `🗓 Мой месяц в трекере потребностей: ${activeDays} ${pluralDays(activeDays)} с записями.\n\n${link}`;
}

export function achievementsShareText(
  earned: number,
  total: number,
  link: string,
): string {
  return `🏅 Достижения в дневнике потребностей: ${earned} из ${total}.\n\n${link}`;
}

export function phraseShareText(phrase: string, link: string): string {
  return `«${phrase}»\n\nФраза Здорового взрослого · ${link}`;
}

/** Текст записи в сообщение не кладём — он на картинке (юзер видит превью). */
export function gratitudeShareText(link: string): string {
  return `🌱 Моя благодарность сегодня.\n\n${link}`;
}
