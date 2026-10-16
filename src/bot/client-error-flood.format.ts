// Строки блока «Поломки на клиенте» про шквал отчётов (находка аудита
// 2026-10-11, src/api/client-error-log-gate.ts). Отдельный модуль — чтобы не
// раздувать client-error-metrics.format.ts (правило №10). Чистая функция.
// Показываются только при >0: на чистой БД и без шквала строк нет.
export interface ClientErrorFlood {
  /** Сумма meta.suppressed за неделю: повторы с одного устройства. */
  repeatsWeek: number;
  /** События с meta.unlogged: подробности не записаны из-за общего потолка. */
  unloggedWeek: number;
}

export function floodLines(m: ClientErrorFlood): string[] {
  const lines: string[] = [];
  if (m.repeatsWeek > 0) {
    lines.push(
      `Повторные отчёты с одного устройства: ${m.repeatsWeek} за неделю — ` +
        'подробности записаны один раз, остальные только посчитаны.',
    );
  }
  if (m.unloggedWeek > 0) {
    lines.push(
      `Подробности не записаны из-за общего потолка: ${m.unloggedWeek} — ` +
        'похоже на залив.',
    );
  }
  return lines;
}
