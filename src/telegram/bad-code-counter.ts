// Счётчик негодных кодов привязки аккаунта (telegram.link.service.ts):
// «считаем промахи и замолкаем». Отдельный модуль — механика не про карточку,
// а про перебор, и тестируется сама по себе.
//
// Перебор восьмизначного кода через чат маловероятен, но бесплатным быть не
// должен: отвечать «не найден» бесконечно — значит подтверждать перебирающему,
// что он ошибся именно кодом.

/** Сколько негодных кодов подряд терпим от одного человека до молчания. */
export const MAX_BAD_CODES = 5;
export const BAD_CODE_WINDOW_MS = 10 * 60_000;
/** Выше этого размера карта подметается от протухших записей. */
const SWEEP_AT = 1000;

export class BadCodeCounter {
  private readonly seen = new Map<number, { count: number; until: number }>();

  constructor(
    private readonly onLimit: (rawId: number) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Пора замолчать: лимит промахов уже выбран и окно ещё не истекло. */
  tooMany(rawId: number): boolean {
    const now = this.now();
    const entry = this.seen.get(rawId);
    if (!entry || entry.until < now) return false;
    return entry.count >= MAX_BAD_CODES;
  }

  /** Записать промах. На ровно пятом — позвать onLimit (аудит-событие). */
  note(rawId: number): void {
    const now = this.now();
    const entry = this.seen.get(rawId);
    const count = entry && entry.until >= now ? entry.count + 1 : 1;
    this.seen.set(rawId, { count, until: now + BAD_CODE_WINDOW_MS });
    if (count === MAX_BAD_CODES) this.onLimit(rawId);
    // Карта не растёт бесконечно: протухшие записи выметаем на входе.
    if (this.seen.size > SWEEP_AT) {
      for (const [id, v] of this.seen) {
        if (v.until < now) this.seen.delete(id);
      }
    }
  }
}
