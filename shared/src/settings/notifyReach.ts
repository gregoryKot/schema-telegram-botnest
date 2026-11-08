import type { UserSettings } from '../apiTypes';
import type { Tr } from '../needs/types';

// Дойдут ли уведомления и куда — одна развилка на все экраны (правило №3).
// QA 2026-11 (З5): у веб-клиента без Telegram тумблеры стояли включёнными, а
// очередь снимала каждое уведомление как «доставить некому». Канал считает
// сервер тем же правилом, по которому шлёт очередь: веб-пуш, если подписано
// хоть одно устройство, иначе Telegram, если привязан (`notifyChannel`).

export type NotifyChannel = 'push' | 'telegram';

/** Нет ответа сервера (старый ответ, дефолты при сбое) — не пугаем зря. */
export function notifyReachable(
  s: Pick<UserSettings, 'notifyReachable'>,
): boolean {
  return s.notifyReachable !== false;
}

/** Куда уходят уведомления. Ответ без notifyChannel (сервер до веб-пушей) —
 *  по notifyReachable: тогда единственным каналом был Telegram. */
export function notifyChannelOf(
  s: Pick<UserSettings, 'notifyChannel' | 'notifyReachable'>,
): NotifyChannel | null {
  if (s.notifyChannel !== undefined) return s.notifyChannel;
  return notifyReachable(s) ? 'telegram' : null;
}

/** Подпись раздела «Уведомления» под заголовком. */
export function notifyChannelHint(
  channel: NotifyChannel | null,
  botHandle: string,
): string {
  if (channel === 'push') return 'Приходят в приложение';
  if (channel === 'telegram') return `Приходят через Telegram — ${botHandle}`;
  return 'Пока не приходят';
}

/**
 * Блок вместо тумблеров, когда уведомлениям некуда прийти. canPush — браузер
 * умеет веб-пуши (или научится после установки на экран «Домой» iPhone);
 * нет — вебвью мессенджера или старый браузер, остаётся Telegram.
 */
export function notifyUnreachableCopy(tr: Tr, canPush: boolean) {
  return {
    text: canPush
      ? tr(
          'Чтобы напоминания приходили, включи их на этом устройстве или привяжи Telegram.',
          'Чтобы напоминания приходили, включите их на этом устройстве или привяжите Telegram.',
        )
      : tr(
          'Этот браузер не присылает уведомления. Открой сайт в Chrome или Safari на телефоне — или привяжи Telegram.',
          'Этот браузер не присылает уведомления. Откройте сайт в Chrome или Safari на телефоне — или привяжите Telegram.',
        ),
    /** Кнопка ведёт в «Аккаунт», где у Telegram есть «Привязать». */
    linkButton: 'Привязать Telegram',
  };
}
