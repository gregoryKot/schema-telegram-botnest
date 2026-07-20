/**
 * Расписание публикаций канала «Здоровый Взрослый» с «дрожанием» (jitter).
 *
 * Раньше пост выходил ровно в 09:00 и 20:00 — регулярность до минуты выдаёт
 * бота. Теперь два окна вокруг 10:00 и 19:00 МСК (±час), и точная минута внутри
 * окна гуляет ото дня ко дню.
 *
 * Почему минута ВЫЧИСЛЯЕТСЯ из даты, а не берётся setTimeout-задержкой: на
 * Amvera каждый деплой перезапускает процесс, и таймер на «через N минут»
 * потерялся бы вместе с постом. Детерминированная минута от даты переживает
 * рестарт — после перезапуска пересчитается та же, и если время уже прошло,
 * ближайший тик крона наверстает (catch-up).
 */

export type HealthyAdultSlot = 'morning' | 'evening';

/** Час начала окна (МСК) для каждого слота. Окно длится WINDOW_MINUTES. */
const SLOT_START_HOUR: Record<HealthyAdultSlot, number> = {
  morning: 9, // окно 09:00–10:55 → центр ~10:00 ±час
  evening: 18, // окно 18:00–19:55 → центр ~19:00 ±час
};

/**
 * Длина окна в минутах. 116 = последний 5-минутный тик крона (10:55 / 19:55):
 * запланированная минута не должна оказаться позже последнего тика, иначе в
 * этот день пост не выйдет.
 */
const WINDOW_MINUTES = 116;

/** МСК = UTC+3 круглый год (Россия не переводит часы с 2014). */
const MSK_OFFSET_MIN = 3 * 60;

interface MskParts {
  hour: number;
  minute: number;
  /** YYYY-MM-DD по МСК — сид для минуты дня и ключ «этот день». */
  dateKey: string;
}

/** Разложить момент в часы/минуты/дату по московскому времени. */
export function mskParts(now: Date): MskParts {
  const shifted = new Date(now.getTime() + MSK_OFFSET_MIN * 60_000);
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    dateKey: shifted.toISOString().slice(0, 10),
  };
}

/** Слот, которому принадлежит час МСК (null — вне обоих окон). */
function slotForHour(hour: number): HealthyAdultSlot | null {
  if (hour === SLOT_START_HOUR.morning || hour === SLOT_START_HOUR.morning + 1)
    return 'morning';
  if (hour === SLOT_START_HOUR.evening || hour === SLOT_START_HOUR.evening + 1)
    return 'evening';
  return null;
}

/**
 * Детерминированная псевдослучайная минута публикации внутри окна [0, WINDOW).
 * Одинаковая весь день (сид = дата+слот), поэтому переживает рестарт; разная
 * ото дня ко дню, поэтому не выглядит как бот. Простой строковый хэш — здесь
 * не нужна криптостойкость, нужна лишь равномерная «размазанность».
 */
export function plannedOffset(dateKey: string, slot: HealthyAdultSlot): number {
  const seed = `${dateKey}:${slot}`;
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % WINDOW_MINUTES;
}

/** Момент относительно начала окна: попадает ли `at` (МСК) в слот-окно `slot` того же дня. */
function isInWindow(
  at: MskParts,
  slot: HealthyAdultSlot,
  dateKey: string,
): boolean {
  if (at.dateKey !== dateKey) return false;
  if (slotForHour(at.hour) !== slot) return false;
  return true;
}

/**
 * Решает, пора ли публиковать прямо сейчас и в какой слот.
 *
 * Возвращает слот, если: текущее время в окне слота, дневная запланированная
 * минута уже наступила, и в этот слот сегодня ещё не публиковали (по времени
 * последнего поста — оно же ловит ручную публикацию, чтобы не выходило два
 * подряд). Иначе null — тик крона просто ничего не делает.
 */
export function dueSlot(
  now: Date,
  lastPostAt: Date | null,
): HealthyAdultSlot | null {
  const parts = mskParts(now);
  const slot = slotForHour(parts.hour);
  if (!slot) return null;

  const offsetNow = (parts.hour - SLOT_START_HOUR[slot]) * 60 + parts.minute;
  if (offsetNow < plannedOffset(parts.dateKey, slot)) return null; // ещё рано

  if (lastPostAt && isInWindow(mskParts(lastPostAt), slot, parts.dateKey)) {
    return null; // уже публиковали в этот слот сегодня
  }
  return slot;
}
