/**
 * Задачи с одним ключом идут строго по очереди, с разными — параллельно.
 *
 * E16 (аудит 2026-11): двойной тап часа в /settings запускал две перепланировки
 * одного человека одновременно. Каждая делает «снять висящее напоминание →
 * поставить новое»; вперемешку это «снять, снять, поставить, поставить» — и
 * в очереди два напоминания. По очереди вторая снимает то, что поставила
 * первая, и запись остаётся одна.
 *
 * Внутри процесса: бот получает апдейты опросом, то есть одним процессом, а
 * Telegraf обрабатывает пачку апдейтов параллельно — двойной тап приходит
 * именно так.
 */
export class PerKeyQueue {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(key: string, job: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const result = prev.then(job);
    // Хвост не падает: сбой одной задачи не отменяет следующую за ней.
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }

  /** Сколько ключей сейчас заняты — для теста, что карта не растёт. */
  get busyKeys(): number {
    return this.tails.size;
  }
}
