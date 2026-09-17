// Прогон проверки по нескольким зонам сразу — из инцидента 2026-09-17:
// календарный день разбирался как полночь зоны машины, и один и тот же
// тест зеленел под TZ=UTC (раннер CI) и краснел на UTC+3 (машина владельца).
// Тест, который сам обходит зоны, ловит такое в любом окружении.
//
// В отличие от jest (там мутация process.env.TZ до V8 не доходит, см.
// src/booking/caldav-busy.spec.ts), в vitest зона переключается на живом
// процессе — node 22 дергает tzset и сбрасывает кэш Intl.
//
// Зоны выбраны по смыслу, а не по вкусу: UTC (как в CI), положительное
// смещение (там баг и нашли), полсуток на восток и отрицательное смещение —
// на нём западный сдвиг превращает полночь дня в предыдущие сутки.
const TIME_ZONES = [
  'UTC',
  'Asia/Jerusalem',
  'Australia/Sydney',
  'America/Los_Angeles',
];

/** Выполняет fn в зоне tz и возвращает зону процесса обратно. */
export function withTimeZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

/**
 * Вызывает fn в каждой зоне из списка. Имя зоны идёт аргументом — его видно
 * в сообщении упавшего expect, иначе непонятно, какая зона сломалась.
 */
export function forEachTimeZone(fn: (tz: string) => void): void {
  for (const tz of TIME_ZONES) withTimeZone(tz, () => fn(tz));
}
