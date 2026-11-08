import type { DeliveryRow } from './delivery-log.format';
import { isUnknownReason } from './unknown-outcome';

/**
 * Кому досылать пост, который вышел не везде. До 2026-08 частичный успех
 * означал пропуск: упавшая площадка теряла публикацию до следующего слота с
 * другой фразой. Повтор всего фан-аута — дубль там, где пост вышел, поэтому
 * та же фраза уходит ТОЛЬКО тем, кто её не принял. Считается по журналу
 * отправок, а не по памяти процесса: рестарт между тиками не стирает долг.
 */
export interface RetryPlan {
  text: string;
  platforms: string[];
  /** Исход неизвестен (пост мог выйти) — не досылаем, проверяет владелец. */
  unknown: string[];
  /** Пост где-то уже вышел (или мог): досылка — добор, а не первый выход. */
  delivered: boolean;
}

/**
 * Строки журнала за слот (новые сверху) → кому досылать. Площадка попадает в
 * список, если её ПОСЛЕДНЯЯ запись — неудача: успешный повтор закрывает долг,
 * а повторная неудача его сохраняет.
 */
export function planRetry(rows: DeliveryRow[]): RetryPlan | null {
  const seen = new Set<string>();
  const failed: string[] = [];
  const unknown: string[] = [];
  let text = '';
  let delivered = false;
  for (const row of rows) {
    if (!text && row.text) text = row.text;
    if (seen.has(row.platform)) continue;
    seen.add(row.platform);
    const maybe = !row.ok && isUnknownReason(row.reason);
    if (row.ok || maybe) delivered = true;
    if (!row.ok) (maybe ? unknown : failed).push(row.platform);
  }
  // Без текста досылать нечего: строка журнала старше версии с текстом.
  if (!text || failed.length + unknown.length === 0) return null;
  return { text, platforms: failed, unknown, delivered };
}
