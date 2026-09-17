/**
 * Промежутки между соседними тиками 5-полевого cron-выражения (минута час
 * день-месяца месяц день-недели). Используется cron-lease-registry.ts, чтобы
 * порог свежести аренды считался из РЕАЛЬНОГО расписания, а не из вручную
 * выбранной категории окна (инцидент 2026-09-16, docs/INCIDENTS.md: оконный
 * крон законно молчит ~22 часа, а порог по категории сгорал за 10 минут).
 *
 * Часовой пояс значения не имеет: промежуток между 9:00 и 9:05 — 5 минут что
 * в Москве, что в UTC, поэтому TZ этому модулю передавать не нужно.
 */

const FIELD_RE = /^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/;

/** Множество значений одного поля cron (минута/час) в границах [min, max]. */
function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const m = FIELD_RE.exec(part);
    if (!m) {
      throw new Error(
        `cron-gap: не удалось разобрать поле «${part}» (в «${field}»)`,
      );
    }
    const [, base, rangeEnd, stepStr] = m;
    const start = base === '*' ? min : Number(base);
    const end =
      base === '*' ? max : rangeEnd !== undefined ? Number(rangeEnd) : start;
    const step = stepStr !== undefined ? Number(stepStr) : 1;
    if (step <= 0 || start > end || start < min || end > max) {
      throw new Error(
        `cron-gap: недопустимое поле «${part}» (граница ${min}-${max})`,
      );
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  return [...values];
}

export interface CronGaps {
  minGapMs: number;
  maxGapMs: number;
}

/** Самый короткий и самый длинный промежуток между соседними тиками. */
export function cronGapsMs(expr: string): CronGaps {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron-gap: не 5 полей в выражении «${expr}»`);
  }
  const [minuteField, hourField, domField, monthField, dowField] = parts;

  const minutes = parseField(minuteField, 0, 59);
  const hours = parseField(hourField, 0, 23);

  const ticks = new Set<number>();
  for (const h of hours) for (const m of minutes) ticks.add(h * 60 + m);
  const sorted = [...ticks].sort((a, b) => a - b);
  if (sorted.length === 0) {
    throw new Error(
      `cron-gap: выражение «${expr}» не порождает ни одного тика`,
    );
  }

  let minGapMin: number;
  let maxGapMin: number;
  if (sorted.length === 1) {
    // Единственный тик в сутках — следующий ровно через сутки.
    minGapMin = 1440;
    maxGapMin = 1440;
  } else {
    minGapMin = Infinity;
    maxGapMin = -Infinity;
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap < minGapMin) minGapMin = gap;
      if (gap > maxGapMin) maxGapMin = gap;
    }
    // Перенос через полночь: от последнего тика суток до первого тика следующих.
    const wrap = sorted[0] + 1440 - sorted[sorted.length - 1];
    if (wrap < minGapMin) minGapMin = wrap;
    if (wrap > maxGapMin) maxGapMin = wrap;
  }

  // День-месяца/месяц/день-недели не «*» — расписание реже суточного (напр.
  // «раз в месяц»). Точную симуляцию таких расписаний не делаем, пока среди
  // leader-кронов проекта их нет: честно возвращаем консервативный потолок в
  // 7 суток, отчего проба свежести становится МЯГЧЕ, а не ложно-красной.
  // minGapMs при этом считаем как обычно — эти поля не меняют межтиковый
  // разрыв внутри активного дня.
  const isDailySchedule =
    domField === '*' && monthField === '*' && dowField === '*';
  return {
    minGapMs: minGapMin * 60_000,
    maxGapMs: isDailySchedule ? maxGapMin * 60_000 : 7 * 24 * 3_600_000,
  };
}
