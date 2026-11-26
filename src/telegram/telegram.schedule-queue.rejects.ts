// Отказы Telegram по строке очереди: сколько раз подряд API ответил «нет».
//
// E16 (аудит 2026-11): ответ 400 на конкретное сообщение («can't parse
// entities», «message is too long») — наша ошибка, человек тут ни при чём,
// поэтому очередь честно не метила его и повторяла на следующем тике. Но тот
// же запрос получает тот же ответ: строка висела в начале getDue (старейшие
// первыми, 500 за тик) вечно, каждый тик слала админу ошибку, а набравшись
// сотнями, вытеснила бы из выборки живые уведомления.
//
// Счётчик живёт в памяти процесса, не в базе: после рестарта строка получит
// ещё MAX_REJECTS попыток — это конечно, и миграция ради этого не нужна.
import { telegramErrorCode } from './telegram-error';

/** Сколько отказов подряд терпим, прежде чем снять строку. */
export const MAX_REJECTS = 3;
// Чтобы карта не росла годами: строки, которые потом ушли, никто не чистит.
const KEEP_IDS = 1000;

/**
 * Отказ, который повтор не исправит: 400 Bad Request — про само сообщение.
 * Только 400: 401/404 значат «битый токен бота» — это про всех сразу, и
 * снимать за них строки нельзя; 429 ждёт PacedSender; сеть и 5xx — не про
 * сообщение. «chat not found» сюда не доходит — его разбирает
 * classifySendFailure.
 */
export function isPermanentRejection(err: unknown): boolean {
  return telegramErrorCode(err) === 400;
}

export class RejectCounter {
  private readonly seen = new Map<number, number>();

  /** Ещё один отказ по строке; true — лимит исчерпан, строку пора снять. */
  strike(id: number): boolean {
    const count = (this.seen.get(id) ?? 0) + 1;
    if (count >= MAX_REJECTS) {
      this.seen.delete(id);
      return true;
    }
    this.seen.set(id, count);
    while (this.seen.size > KEEP_IDS) {
      const oldest = this.seen.keys().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
    return false;
  }
}
