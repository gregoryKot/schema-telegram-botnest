// Уведомление очереди → payload веб-пуша, который читает service worker
// сайта (webapp/public/sw.js): { title, body, url, tag, silent? }.
//
// Текст — тот же шаблон, что уходит в Telegram (notification.templates.ts,
// обе формы обращения). Кнопок у пуша нет: тап открывает `url`. Адрес берём
// из первой кнопки шаблона, ведущей на сам сайт (web_app или url на APP_URL),
// — путь и query (`/today?startapp=tasks_42`). Кнопки-действия бота
// (callback) и внешние адреса (визитка kotlarewski.gr) пушу не подходят —
// тогда «Сегодня». url — ВСЕГДА путь того же сайта: начинается с '/', не с
// '//' (иначе браузер прочтёт его как адрес чужого хоста).
import { APP_URL } from '../telegram/telegram.constants';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  silent?: boolean;
}

export const PUSH_TITLE = 'Всё по схеме';
export const PUSH_BODY_MAX = 300;
export const PUSH_FALLBACK_URL = '/today';
// Итог дня у Telegram уходит без звука (disable_notification) — так же и тут.
const SILENT_TYPES: ReadonlySet<string> = new Set(['summary']);

/** Обрезка по границе слова с «…»; короткий текст — как есть. */
export function clipBody(text: string, max = PUSH_BODY_MAX): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.search(/\s\S*$/);
  const base = space > max / 2 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,.:;—-]+$/, '')}…`;
}

/** Адрес того же сайта → путь+query; чужой или битый адрес → null. */
export function sitePath(href: string, base = APP_URL): string | null {
  let url: URL;
  let site: URL;
  try {
    url = new URL(href);
    site = new URL(base);
  } catch {
    return null;
  }
  if (url.origin !== site.origin) return null;
  const path = `${url.pathname}${url.search}`;
  return path.startsWith('/') && !path.startsWith('//') ? path : null;
}

type Button = { url?: unknown; web_app?: { url?: unknown } };

/** Первая кнопка разметки, ведущая на сам сайт. */
export function pathFromMarkup(markup: unknown, base = APP_URL): string {
  const rows = (markup as { inline_keyboard?: unknown } | null)
    ?.inline_keyboard;
  if (!Array.isArray(rows)) return PUSH_FALLBACK_URL;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const btn of row as Button[]) {
      const href = btn?.web_app?.url ?? btn?.url;
      if (typeof href !== 'string') continue;
      const path = sitePath(href, base);
      if (path) return path;
    }
  }
  return PUSH_FALLBACK_URL;
}

/** Текст и разметка шаблона → payload пуша (чистая функция). */
export function toPushPayload(
  type: string,
  text: string,
  markup?: unknown,
): PushPayload {
  return {
    title: PUSH_TITLE,
    body: clipBody(text),
    url: pathFromMarkup(markup),
    tag: type,
    ...(SILENT_TYPES.has(type) ? { silent: true } : {}),
  };
}
