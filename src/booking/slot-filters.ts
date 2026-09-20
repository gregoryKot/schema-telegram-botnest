// Пересечения интервалов и применение ручного слоя (SlotOverride) к списку
// слотов. overlapsBusy/isOccupied — перенесены из slot.service.ts без
// изменения поведения (правило №10: файл slot.service.ts упирался в потолок
// бейслайна); applyOverrides — новая логика контракта «Календарь слотов».

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotLike {
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
}

export interface OverrideLike {
  kind: 'BLOCK' | 'OPEN';
  startsAt: Date;
  durationMin: number;
}

/** Полуоткрытые интервалы [start,end) пересекаются хотя бы с одним из списка. */
export function overlapsInterval(
  start: Date,
  end: Date,
  intervals: Interval[],
): boolean {
  return intervals.some(
    (iv) =>
      start.getTime() < iv.end.getTime() && end.getTime() > iv.start.getTime(),
  );
}

/** Занятость из внешнего календаря (CalDAV). */
export function overlapsBusy(
  start: Date,
  end: Date,
  busy: Interval[],
): boolean {
  return overlapsInterval(start, end, busy);
}

/** Занятость существующими HELD/CONFIRMED бронями. */
export function isOccupied(
  start: Date,
  end: Date,
  bookings: { startsAt: Date; durationMin: number }[],
): boolean {
  return overlapsInterval(
    start,
    end,
    bookings.map((b) => ({
      start: b.startsAt,
      end: new Date(b.startsAt.getTime() + b.durationMin * 60_000),
    })),
  );
}

export function overrideInterval(o: OverrideLike): Interval {
  return {
    start: o.startsAt,
    end: new Date(o.startsAt.getTime() + o.durationMin * 60_000),
  };
}

export interface ApplyOverridesCtx {
  /** Слот не раньше этого момента (мс, now + MIN_BOOK_LEAD_HOURS). */
  earliest: number;
  bookings: { startsAt: Date; durationMin: number }[];
  /** Занятость календаря — уже [] от вызывающего, если блокировка выключена. */
  busy: Interval[];
}

/**
 * Ручной слой поверх слотов правил: BLOCK убирает пересекающиеся слоты,
 * OPEN добавляет разовые вне правил (если проходит те же проверки, что и
 * обычный слот, плюс не дублирует уже существующий по startsAt). Результат
 * отсортирован по startsAt — как и раньше отдавал SlotService.getSlots.
 */
export function applyOverrides(
  slots: SlotLike[],
  overrides: OverrideLike[],
  ctx: ApplyOverridesCtx,
): SlotLike[] {
  const blockIntervals = overrides
    .filter((o) => o.kind === 'BLOCK')
    .map(overrideInterval);

  const kept = slots.filter(
    (s) => !overlapsInterval(s.startsAt, s.endsAt, blockIntervals),
  );
  const keptStarts = new Set(kept.map((s) => s.startsAt.getTime()));

  const extra: SlotLike[] = [];
  for (const o of overrides) {
    if (o.kind !== 'OPEN') continue;
    const start = o.startsAt;
    const end = new Date(start.getTime() + o.durationMin * 60_000);
    if (keptStarts.has(start.getTime())) continue; // уже есть слот в это время
    if (start.getTime() <= ctx.earliest) continue; // прошлое / меньше лид-тайма
    if (isOccupied(start, end, ctx.bookings)) continue;
    if (overlapsBusy(start, end, ctx.busy)) continue;
    if (overlapsInterval(start, end, blockIntervals)) continue;
    extra.push({ startsAt: start, endsAt: end, durationMin: o.durationMin });
  }

  return [...kept, ...extra].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}
