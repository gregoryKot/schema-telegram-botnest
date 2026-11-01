// Чистые вычисления экрана «Профиль»: раскладка тепловой карты, уровни,
// подписи месяцев, прогресс достижений, формат даты сессии, склонение.

export const HEAT_WEEKS = 18;
/** Ширина, до которой кабинет считается телефонным (синхронно с @media в css). */
export const PHONE_MAX_WIDTH = 767;
const HEAT_MIN_WEEKS = 8;
const HEAT_MAX_PHONE_WEEKS = 16;
const HEAT_MIN_CELL = 18;
const HEAT_GAP = 3;
// Поля вокруг сетки на телефоне: поля страницы 2×16 + карточка 2×16 + рамка 2 + колонка подписей дней 22.
const HEAT_PHONE_CHROME = 88;
export const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Календарный день YYYY-MM-DD в UTC — так же, как история дней на сервере и
 *  «сегодня» приложения (правило №25 CLAUDE.md, shared/src/utils/calendarDate). */
export function utcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Уровень дня 0..3 по числу оценённых потребностей: 0 — нет записи, 1 — 1–2, 2 — 3–4, 3 — 5 и больше. */
export function dayLevel(ratings: Record<string, number> | null | undefined): number {
  const n = ratings ? Object.keys(ratings).length : 0;
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  return 3;
}

/** Карта «дата → уровень» из истории. День есть в истории, но без оценок — уровень 1 (запись была). */
export function buildLevelMap(history: { date: string; ratings?: Record<string, number> }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of history) m.set(h.date, Math.max(1, dayLevel(h.ratings)));
  return m;
}

/** Сколько недель тепловой карты влезает в экран: на десктопе все 18, на телефоне — по ширине (клетка ≥18px), 8–16. */
export function heatWeeksForWidth(width: number): number {
  if (width > PHONE_MAX_WIDTH) return HEAT_WEEKS;
  const fit = Math.floor((width - HEAT_PHONE_CHROME + HEAT_GAP) / (HEAT_MIN_CELL + HEAT_GAP));
  return Math.min(HEAT_MAX_PHONE_WEEKS, Math.max(HEAT_MIN_WEEKS, fit));
}

export interface HeatCell { dateStr: string; level: number; future: boolean }

/** Недели (пн–вс), последняя содержит сегодня. */
export function buildHeatWeeks(levels: Map<string, number>, today: Date, weeks = HEAT_WEEKS): HeatCell[][] {
  const todayDow = (today.getUTCDay() + 6) % 7;
  const startMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - todayDow - (weeks - 1) * 7);
  const todayStr = utcDateStr(today);
  const out: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = utcDateStr(new Date(startMs + (w * 7 + d) * 86_400_000));
      const future = dateStr > todayStr;
      week.push({ dateStr, level: future ? 0 : levels.get(dateStr) ?? 0, future });
    }
    out.push(week);
  }
  return out;
}

/** Подпись месяца над неделей, в которой он начинается (первая неделя — всегда подписана). */
export function monthLabels(weeks: HeatCell[][]): string[] {
  let prev = -1;
  return weeks.map(week => {
    const month = Number(week[0].dateStr.slice(5, 7)) - 1;
    const label = month !== prev ? MONTH_SHORT[month] : '';
    prev = month;
    return label;
  });
}

/** «день / дня / дней» по числу. */
export function daysWord(n: number): string {
  const m100 = n % 100, m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return 'дней';
  if (m10 === 1) return 'день';
  if (m10 >= 2 && m10 <= 4) return 'дня';
  return 'дней';
}

const PROGRESS_TARGET: Record<string, { kind: 'streak' | 'total'; goal: number }> = {
  streak_3: { kind: 'streak', goal: 3 }, streak_7: { kind: 'streak', goal: 7 },
  streak_14: { kind: 'streak', goal: 14 }, streak_30: { kind: 'streak', goal: 30 },
  streak_100: { kind: 'streak', goal: 100 },
  total_10: { kind: 'total', goal: 10 }, total_50: { kind: 'total', goal: 50 },
};

/** Прогресс к ещё не полученному достижению («5/7») или null. */
export function achievementProgress(id: string, earned: boolean, currentStreak: number, totalDays: number): string | null {
  if (earned) return null;
  const t = PROGRESS_TARGET[id];
  if (!t) return null;
  const v = t.kind === 'streak' ? currentStreak : totalDays;
  return v > 0 ? `${v}/${t.goal}` : null;
}

/** Инициалы для аватара: первая буква имени (пусто → '•'). */
export function avatarInitial(name: string | null | undefined): string {
  const c = (name ?? '').trim().charAt(0);
  return c ? c.toUpperCase() : '•';
}

export type TrendKind = 'up' | 'down' | 'flat';
export function trendKind(trend: string): TrendKind {
  return trend === '↑' ? 'up' : trend === '↓' ? 'down' : 'flat';
}
export const TREND_SYMBOL: Record<TrendKind, string> = { up: '↑', down: '↓', flat: '≈' };

/** Заполнение полосы паттерна: среднее по шкале 0–10 → 0–100%. */
export function patternBarPercent(avg: number | null): number {
  return Math.min(100, Math.max(0, Math.round((avg ?? 0) * 10)));
}
