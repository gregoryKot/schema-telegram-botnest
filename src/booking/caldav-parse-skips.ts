// Счёт VEVENT, которые разбор занятости не понял. parseBusy (caldav-busy.ts)
// fail-open: из-за одного кривого события календарь не роняется, событие
// просто не закрывает слоты (или закрывает час вместо настоящего конца). До
// 2026-11 это было видно только глазами владельца; теперь счёт последнего
// чтения (caldav.service.ts → readBusyAll) хранится здесь и выводится в детали
// пробы самопроверки caldav и в блок «Личный календарь» /stats (caldav-health.ts).

export interface BusySkips {
  /** RRULE-мастер: iCloud не развернул повторы, `<c:expand>` не сработал. */
  recurring: number;
  /** DTSTART нет или он не разобран — событие выпало целиком. */
  badStart: number;
  /** DTEND есть, но не разобран — конец взят по умолчанию (час или сутки). */
  badEnd: number;
}

export const noSkips = (): BusySkips => ({
  recurring: 0,
  badStart: 0,
  badEnd: 0,
});

/** Сумма по прочитанным календарям; упавшее чтение (без `skipped`) — ноль. */
export function sumSkips(
  reads: { ok: boolean; skipped?: BusySkips }[],
): BusySkips {
  const sum = noSkips();
  for (const { skipped: s } of reads) {
    if (!s) continue;
    sum.recurring += s.recurring;
    sum.badStart += s.badStart;
    sum.badEnd += s.badEnd;
  }
  return sum;
}

let last: BusySkips | null = null;

/** Последнее чтение занятости процесса — тот же приём, что calDavHealth. */
export const busySkips = {
  note(s: BusySkips): void {
    last = { ...s };
  },
  last(): BusySkips | null {
    return last ? { ...last } : null;
  },
  reset(): void {
    last = null;
  },
};

/** Строка для владельца; null — чтения не было или разобрано всё. */
export function formatSkips(s: BusySkips | null): string | null {
  const total = s ? s.recurring + s.badStart + s.badEnd : 0;
  if (!s || total === 0) return null;
  const parts = [
    [s.recurring, 'повторяющихся без разворота'],
    [s.badStart, 'без понятного начала'],
    [s.badEnd, 'с непонятным концом'],
  ] as const;
  const why = parts
    .filter(([n]) => n > 0)
    .map(([n, what]) => `${what} — ${n}`)
    .join(', ');
  return (
    `при последнем чтении занятости не разобрано событий: ${total} (${why}); ` +
    'их часы могут остаться открытыми для записи'
  );
}
