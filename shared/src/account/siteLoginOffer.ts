// Кому показать приглашение «добавь почту, VK ID или Яндекс ID» — и когда оно молчит.
//
// Входа через Telegram на сайте нет с 2026-11 (запрос Роскомнадзора:
// пользователей из России нельзя авторизовать на сайте через иностранный
// сервис). Человек, у которого единственный способ входа — Telegram, открывает
// приложение только внутри Telegram; на сайт и в приложение с экрана телефона
// он попадёт, когда добавит почту, VK ID или Яндекс ID. Приглашение показываем только ему
// и только там, где он есть, — внутри Telegram.
//
// Чистые функции: решение продуктовое и проверяется таблицей (как linkTarget.ts).

export interface SiteLoginInput {
  /** Способы входа аккаунта; null — ответ сервера ещё не пришёл. */
  providers: string[] | null;
  hostId: string;
}

/**
 * true — у аккаунта только Telegram, и открыт он в Telegram. Пустой список и
 * null — «ничего не знаем»: звать добавить то, что, может быть, уже есть,
 * значит показывать выдуманное состояние.
 */
export function needsSiteLogin({ providers, hostId }: SiteLoginInput): boolean {
  if (hostId !== 'telegram') return false;
  if (!providers || providers.length === 0) return false;
  return providers.every((p) => p === 'telegram');
}

// ── «Позже» ─────────────────────────────────────────────────────────────────
// Откладывается на неделю и возвращается: без второго способа входа человек
// на сайт не попадёт, поэтому «не предлагать никогда» здесь нет — карточка
// исчезает сама, когда способ добавлен.

const KEY = 'site_login_offer';
export const SITE_LOGIN_SNOOZE_DAYS = 7;
const DAY_MS = 86_400_000;

/** Отложено ли приглашение на момент `now`. Мусор в хранилище — не отложено. */
export function isSiteLoginSnoozed(now: number = Date.now()): boolean {
  try {
    const until = Number(localStorage.getItem(KEY));
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

/** false — запомнить не вышло (приватный режим): приглашение вернётся в следующий раз. */
export function snoozeSiteLogin(now: number = Date.now()): boolean {
  try {
    localStorage.setItem(KEY, String(now + SITE_LOGIN_SNOOZE_DAYS * DAY_MS));
    return true;
  } catch {
    return false;
  }
}
