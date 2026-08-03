import type { DeliveryRow } from './delivery-log.format';

/**
 * Кому досылать пост, который вышел не везде.
 *
 * До 2026-08 частичный успех означал пропуск: как только пост приняла хотя бы
 * одна площадка, слот закрывался, и упавшая площадка теряла публикацию до
 * следующего слота — где будет уже другая фраза. Повторять весь фан-аут нельзя
 * (дубль там, где пост уже вышел), поэтому повтор адресный: та же фраза уходит
 * ТОЛЬКО тем, кто её не принял.
 *
 * Считается по журналу отправок, а не по памяти процесса: рестарт контейнера
 * между тиками крона не должен стирать долг.
 */
export interface RetryPlan {
  text: string;
  platforms: string[];
}

/**
 * Строки журнала за слот (новые сверху) → кому досылать. Площадка попадает в
 * список, если её ПОСЛЕДНЯЯ запись — неудача: успешный повтор закрывает долг,
 * а повторная неудача его сохраняет.
 */
export function planRetry(rows: DeliveryRow[]): RetryPlan | null {
  const seen = new Set<string>();
  const failed: string[] = [];
  let text = '';
  for (const row of rows) {
    if (!text && row.text) text = row.text;
    if (seen.has(row.platform)) continue;
    seen.add(row.platform);
    if (!row.ok) failed.push(row.platform);
  }
  // Без текста досылать нечего: строка журнала старше версии с текстом.
  if (!text || failed.length === 0) return null;
  return { text, platforms: failed };
}
