import { Interval } from './caldav-busy';
import { slotsBusyWindow } from './slot-range';

// Кэш занятости календаря (аудит 2026-11, S17). Раньше кэш был одной записью
// по ключу окна: публичный GET /api/booking/slots с каждой новой парой дат
// делал новый REPORT в iCloud — чужой скрипт перебором дат превращал ручку в
// усилитель запросов к календарю владельца. Теперь одно широкое окно
// (slotsBusyWindow: вчера … горизонт записи) читается раз в TTL, а ответ на
// любое окно внутри него нарезается из прочитанного. Окна вне широкого
// (админский календарь листает прошлые недели — ручка за ключом) идут
// прежним путём: точный ключ, тот же TTL.

export const BUSY_TTL_MS = 60_000;

type Read = (from: Date, to: Date) => Promise<Interval[]>;

interface Entry {
  key: string;
  exp: number;
  val: Promise<Interval[]>;
}

/** Интервалы, пересекающие [from, to] (то же правило, что time-range в REPORT). */
export function sliceBusy(all: Interval[], from: Date, to: Date): Interval[] {
  return all.filter((i) => i.start < to && i.end > from);
}

export class BusyCache {
  private wide: Entry | null = null;
  private exact: Entry | null = null;

  constructor(private readonly read: Read) {}

  async get(from: Date, to: Date, now = Date.now()): Promise<Interval[]> {
    const win = slotsBusyWindow(now);
    if (from >= win.from && to <= win.to) {
      this.wide = this.fresh(this.wide, win.from, win.to, now);
      return sliceBusy(await this.wide.val, from, to);
    }
    this.exact = this.fresh(this.exact, from, to, now);
    return this.exact.val;
  }

  /**
   * Запись того же окна, пока не истекла, — иначе новое чтение. Промис кладётся
   * в кэш сразу: параллельные запросы ждут одно чтение, а не шлют по REPORT.
   * Упавшее чтение из кэша убирается — следующий запрос попробует снова.
   */
  private fresh(e: Entry | null, from: Date, to: Date, now: number): Entry {
    const key = `${from.getTime()}_${to.getTime()}`;
    if (e && e.key === key && now < e.exp) return e;
    const entry: Entry = {
      key,
      exp: now + BUSY_TTL_MS,
      val: this.read(from, to),
    };
    entry.val.catch(() => {
      if (this.wide === entry) this.wide = null;
      if (this.exact === entry) this.exact = null;
    });
    return entry;
  }
}
