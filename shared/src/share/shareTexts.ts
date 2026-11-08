// Тексты для шаринга — чистые билдеры (тесты — shareTexts.test.ts).
// Формулировки от 1-го лица или безличные: не зависят ни от ты/вы, ни от рода.
// link — ссылка на бота (botShortUrl конкретного фронтенда).
import { pluralDays } from '../utils/celebrationText';
import { HEALTHY_ADULT_CHANNEL_SHORT_URL } from './channelLinks';
import { THERAPIST_SEES_BY_DEFAULT } from '../therapy/therapistLinkCopy';

export function pluralEntries(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'запись';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return 'записи';
  return 'записей';
}

export function achievementShareText(title: string, link: string): string {
  return `Новое достижение — «${title}»!\n\nВеду дневник потребностей. ${link}`;
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

/** Приглашение в пару: код + deep-link (ссылку строит фронт). */
export function pairInviteShareText(code: string, deepLink: string): string {
  return `🤝 Присоединяйся — отслеживаем эмоциональные потребности вместе.\n\nКод пары: ${code}\n${deepLink}`;
}

/** Приглашение в приложение: сайт (открывается и без Telegram) первой ссылкой, бот (botLink) — второй строкой. */
export function appInviteShareText(botLink: string): string {
  return `🌱 Отмечаю здесь пять базовых эмоциональных потребностей — видно, что питает, а что истощает.\n\nhttps://schemehappens.ru\nВ Telegram: ${botLink}`;
}

/** Приглашение клиенту от терапевта: код и ссылки, которые выдал сервер. */
export interface TherapistInviteLinks {
  code: string;
  /** Сайт: открывается без Telegram, после входа подключает (`?startapp=therapy_…`). */
  url: string;
  /** Приложение в Telegram; null — бот не настроен. */
  tgUrl?: string | null;
}

/**
 * Сообщение клиенту от терапевта (аудит 2026-11, U3): сайт первой ссылкой, код
 * для ввода вручную, Telegram второй строкой. Раньше была одна ссылка t.me и
 * обещание «подключится трекер», хотя терапевт видит больше — теперь список
 * честный (THERAPIST_SEES_BY_DEFAULT, сверен с сервером). Безличный: форма
 * обращения терапевта в приложении не говорит, как он обращается к клиенту.
 */
export function therapistInviteShareText(invite: TherapistInviteLinks): string {
  const lines = [
    'Приглашение в приложение «Всё по схеме»: отметки и записи из него можно будет смотреть вместе на сессиях.',
    `Терапевт видит трекер потребностей и задания, а по умолчанию ещё ${THERAPIST_SEES_BY_DEFAULT}. Лишнее закрывается в настройках, раздел «Мой терапевт».`,
    '',
    `Подключиться на сайте: ${invite.url}`,
    `Или ввести код ${invite.code} в приложении: Настройки → «Мой терапевт».`,
  ];
  if (invite.tgUrl) lines.push(`В Telegram: ${invite.tgUrl}`);
  return lines.join('\n');
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

export function phraseShareText(phrase: string): string {
  return `«${phrase}»\n\nКаждый день новая фраза — в канале «Здоровый Взрослый»: ${HEALTHY_ADULT_CHANNEL_SHORT_URL}`;
}

/** Текст записи в сообщение не кладём — он на картинке (юзер видит превью). */
export function gratitudeShareText(link: string): string {
  return `🌱 Моя благодарность сегодня.\n\n${link}`;
}

/** Карточка записи режима: слова самоподдержки — на картинке, не в тексте. */
export function modeEntryShareText(link: string): string {
  return `🌿 Голос моего Здорового Взрослого.\n\n${link}`;
}

/** Карточка полной записи режима: сама запись — на картинке, не в тексте. */
export function modeEntryFullShareText(link: string): string {
  return `🌿 Моя запись из дневника режимов.\n\n${link}`;
}

/** Краткая карточка разбора фразы: обе реплики — на картинке, не в тексте. */
export function phraseCheckShareText(link: string): string {
  return `🔎 Одна фраза — два голоса: как это звучит у критика и как у заботы.\n\n${link}`;
}

/** Полный разбор: приметы и фраза остаются на картинке. */
export function phraseCheckFullShareText(link: string): string {
  return `🔎 Разбор своей фразы по приметам самокритики.\n\n${link}`;
}

export function journeyShareText(
  count: number,
  link: string,
  period: 'all' | 'week' | 'month' = 'all',
): string {
  const head =
    period === 'week'
      ? '🧭 Моя неделя'
      : period === 'month'
        ? '🧭 Мой месяц'
        : '🧭 Мой путь';
  return `${head}: ${count} ${pluralEntries(count)} заботы о себе — дневники, практики, тесты.\n\n${link}`;
}

/** Один шаг из ленты «Мой путь» (выполненная практика, запись дневника…). */
export function journeyItemShareText(
  emoji: string,
  label: string,
  link: string,
): string {
  return `${emoji} ${label} — ещё один шаг заботы о себе.\n\n${link}`;
}

/** Быстрая практика «Здесь и сейчас» (дыхание, заземление, «Стоп»). link — необязателен: карточка может уйти без подписи-ссылки. */
export function practiceShareText(
  title: string,
  countLabel: string | null,
  link?: string,
): string {
  const countStr = countLabel ? ` ${countLabel}.` : '';
  const linkStr = link ? `\n\n${link}` : '';
  return `🧘 ${title}.${countStr}${linkStr}`;
}
