/**
 * Ограничитель попыток публикации внутри одного слота канала «ЗВ».
 *
 * Инцидент 2026-07-29: отправка в канал падала, пост не записывался — и
 * `dueSlot` честно возвращал «пора» на КАЖДОМ тике крона. Тик раз в 5 минут,
 * окно два часа: 24 попытки, 24 одинаковых DM админу за утро. Ошибку надо
 * показать один раз и перестать долбиться до следующего слота: если Telegram
 * недоступен третью попытку подряд, четвёртая ничего не изменит.
 */
export class SlotAttempts {
  private readonly tries = new Map<string, number>();

  constructor(
    private readonly max = 3,
    private readonly keepKeys = 8,
  ) {}

  /** Остались ли попытки в этом слоте. */
  allow(key: string): boolean {
    return (this.tries.get(key) ?? 0) < this.max;
  }

  /**
   * Зафиксировать неудачу. `exhausted` — попытки кончились: это ровно один
   * момент на слот, в который стоит будить админа.
   */
  fail(key: string): { attempt: number; exhausted: boolean } {
    const attempt = (this.tries.get(key) ?? 0) + 1;
    this.tries.set(key, attempt);
    this.prune();
    return { attempt, exhausted: attempt >= this.max };
  }

  /** Успех — слот закрыт, счётчик не нужен. */
  reset(key: string): void {
    this.tries.delete(key);
  }

  // Слотов два в день; держим горстку последних, чтобы карта не росла годами.
  private prune(): void {
    while (this.tries.size > this.keepKeys) {
      const oldest = this.tries.keys().next().value;
      if (oldest === undefined) return;
      this.tries.delete(oldest);
    }
  }
}
