// Кому показать приглашение «добавь VK ID или Яндекс ID» — и когда оно молчит.
//
// На сайт входят через VK ID и Яндекс ID; из MAX сессию передают в браузер.
// Telegram открывает приложение только внутри Telegram (запрос Роскомнадзора:
// пользователей из России нельзя авторизовать на сайте через иностранный
// сервис), а вход по почте убирается (решение владельца, ч. 10 ст. 8 149-ФЗ).
// Приглашение видно внутри Telegram (SiteAccessCard) и на сайте, в «Аккаунте»
// (SiteLoginHint), — тому, у кого ни VK ID, ни Яндекс ID, ни MAX.
//
// Чистые функции: решение продуктовое и проверяется таблицей (как linkTarget.ts).

/** Чем попадают на сайт: VK ID и Яндекс ID — вход, MAX — передача сессии в браузер. */
const SITE_ACCESS: readonly string[] = ['vk', 'yandex', 'max'];

export interface SiteLoginInput {
  /** Способы входа аккаунта; null — ответ сервера ещё не пришёл. */
  providers: string[] | null;
  hostId: string;
}

/**
 * true — открыто в Telegram или на сайте, и попасть на сайт аккаунту нечем.
 * Пустой список и null — «ничего не знаем»: звать добавить то, что, может
 * быть, уже есть, значит показывать выдуманное состояние.
 */
export function needsSiteLogin({ providers, hostId }: SiteLoginInput): boolean {
  if (hostId !== 'telegram' && hostId !== 'web') return false;
  if (!providers || providers.length === 0) return false;
  return !providers.some((p) => SITE_ACCESS.includes(p));
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
