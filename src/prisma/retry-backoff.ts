// Пауза между повторами транзакции после конфликта сериализации
// (serializable-retry.ts).

/** Потолок паузы перед второй попыткой; дальше удваивается. */
export const RETRY_BASE_DELAY_MS = 20;

/**
 * Пауза перед попыткой `attempt + 1`: случайная в [потолок/2, потолок), потолок
 * удваивается. Без паузы проигравшие повторяются одновременно и сталкиваются
 * снова; случайность разводит их, нижняя половина даёт победителю закоммитить.
 */
export function retryDelayMs(attempt: number, random = Math.random): number {
  const ceiling = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.round(ceiling * (0.5 + random() / 2));
}

export interface RetryTiming {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
