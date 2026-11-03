// Давность активности клиента — одна подпись на кабинет терапевта: «Сегодня»
// (сессии, «Активность клиентов», «Требуют внимания») и строка под именем в
// списке клиентов. QA 2026-11: после недели тишины один экран писал «нет
// активности 12 дн.», другой — «активность 24 окт», без записей — «нет данных»
// против «нет активности». Давность — по календарю клиента: число дней считает
// сервер (daysSinceActive, правило №25), формат — общий serverAgoLabel.
import type { TherapyClientSummary } from '../types';
import { serverAgoLabel } from '../utils/calendarAgo';
import { isVirtualId } from '../utils/sameId';

type ActivitySource = Pick<
  TherapyClientSummary,
  'telegramId' | 'lastActiveDate' | 'daysSinceActive' | 'todayIndex'
>;

/** «активность сегодня / вчера / 4 дн. назад / 24 окт»; без записей — «нет
 *  активности». У офлайн-клиента аккаунта нет, активности не бывает — null. */
export function clientActivityLabel(c: ActivitySource): string | null {
  if (isVirtualId(c.telegramId)) return null; // офлайн-клиент (isVirtualClient)
  // Индекс дня есть только у заполнившего сегодня — даже у кэша без daysSinceActive.
  const ago =
    c.todayIndex != null
      ? 'сегодня'
      : serverAgoLabel(c.lastActiveDate, c.daysSinceActive);
  return ago ? `активность ${ago}` : 'нет активности';
}
