import type { UserSettings } from '../apiTypes';

// Дойдут ли уведомления — одна развилка на оба раздела «Уведомления» (правило
// №3). QA 2026-11 (З5): у веб-клиента без Telegram «Итоги дня» и
// «Напоминание» были включены, рядом стояли время и частота, а очередь
// снимала каждое уведомление как «доставить некому» — человек ждал
// напоминаний, которых не будет. Признак `notifyReachable` считает сервер по
// тому же адресу, по которому шлёт очередь (AccountService.isNotifyReachable).

/** Нет ответа сервера (старый ответ, дефолты при сбое) — не пугаем зря. */
export function notifyReachable(
  s: Pick<UserSettings, 'notifyReachable'>,
): boolean {
  return s.notifyReachable !== false;
}

export const NOTIFY_UNREACHABLE = {
  hint: 'Приходят только в Telegram',
  text: 'Уведомления приходят в Telegram, а к этому аккаунту он не привязан — пока они не придут.',
  /** Сайт: кнопка ведёт в «Аккаунт», где есть «Привязать» у Telegram. */
  linkButton: 'Привязать Telegram',
  /** Мини-апп вне Telegram (MAX): привязка — на сайте. */
  linkElsewhere:
    'Привязать Telegram можно на сайте schemehappens.ru, раздел «Аккаунт».',
} as const;
