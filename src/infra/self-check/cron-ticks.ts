import { parseField } from './cron-gap';

/**
 * Моменты последних тиков 5-полевого cron-выражения. Нужны пробе аренд
 * (cron-lease-verdict.ts), чтобы судить по пропущенным ТИКАМ, а не по
 * возрасту аренды: после аварии базы оконный крон канала иначе краснел до
 * следующего окна — до ~16 ч после восстановления (2026-10-17, INCIDENTS.md).
 *
 * Часовой пояс — как у планировщика: `tz` не задан → локальное время
 * процесса (так `@nestjs/schedule` исполняет `@Cron` без `timeZone`); задан →
 * настенное время этой зоны.
 *
 * Минута перехода на летнее/зимнее время осознанно не моделируется точно:
 * несуществующая настенная минута (весной) уезжает на час вперёд, двойная
 * (осенью) даёт один момент из двух. Проба от этого может ошибиться на один
 * тик раз в полгода — не на два, а сбой она объявляет только по двум.
 */

const MINUTE_MS = 60_000;

/** Настенные дата и минута суток момента `at` в зоне `tz` (или локальной). */
function wallParts(at: Date, tz?: string) {
  if (tz === undefined) {
    return {
      y: at.getFullYear(),
      mo: at.getMonth(),
      d: at.getDate(),
      h: at.getHours(),
      mi: at.getMinutes(),
    };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    y: get('year'),
    mo: get('month') - 1,
    d: get('day'),
    h: get('hour'),
    mi: get('minute'),
  };
}

/** Смещение зоны в момент `ms`: настенное время как будто UTC минус момент. */
function zoneOffsetMs(ms: number, tz: string): number {
  const w = wallParts(new Date(ms), tz);
  const wallAsUtc = Date.UTC(w.y, w.mo, w.d, w.h, w.mi);
  return wallAsUtc - Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

/** Настенное «день + минута суток» → момент. Для зоны — два прохода
 * смещения: первое берётся по ошибочной догадке, второе — по уже почти
 * верному моменту, что и даёт правильный ответ по обе стороны перехода. */
function wallToInstant(
  y: number,
  mo: number,
  d: number,
  minuteOfDay: number,
  tz?: string,
): number {
  const h = Math.floor(minuteOfDay / 60);
  const mi = minuteOfDay % 60;
  if (tz === undefined) return new Date(y, mo, d, h, mi).getTime();
  const guess = Date.UTC(y, mo, d, h, mi);
  const first = guess - zoneOffsetMs(guess, tz);
  return guess - zoneOffsetMs(first, tz);
}

/** Минуты суток, в которые тикает суточное расписание; null — расписание не
 * суточное (день-месяца, месяц или день недели не `*`). */
function dailyTickMinutes(expr: string): number[] | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minuteField, hourField, dom, month, dow] = parts;
  if (dom !== '*' || month !== '*' || dow !== '*') return null;
  const out: number[] = [];
  for (const h of parseField(hourField, 0, 23))
    for (const m of parseField(minuteField, 0, 59)) out.push(h * 60 + m);
  return out.sort((a, b) => b - a);
}

/**
 * `count` последних тиков с моментом ≤ `at`, по убыванию. null — расписание
 * не суточное: вызывающий откатывается к правилу возраста аренды.
 */
export function latestTicks(
  expr: string,
  at: Date,
  tz?: string,
  count = 2,
): Date[] | null {
  const minutes = dailyTickMinutes(expr);
  if (!minutes || minutes.length === 0) return null;
  const today = wallParts(at, tz);
  const found = new Set<number>();
  // Один тик в сутках → нужно count+1 суток назад; запас в сутки — на
  // переход времени, когда настенные сутки короче 24 ч.
  for (let back = 0; back <= count + 1 && found.size < count; back += 1) {
    const day = new Date(Date.UTC(today.y, today.mo, today.d - back));
    for (const minute of minutes) {
      const ms = wallToInstant(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        minute,
        tz,
      );
      if (ms <= at.getTime()) found.add(ms);
      if (found.size >= count) break;
    }
  }
  return [...found]
    .sort((a, b) => b - a)
    .slice(0, count)
    .map((ms) => new Date(ms));
}
