// Денежные пути и тихие catch: бейслайна для них нет (аудит 2026-10-11,
// frontends#0). Отмена подписки глотала отказ `catch { /* ignore */ }` — и два
// месяца жила в silent-catch-baseline.json как «долг», пока списание уходило
// человеку, который считал подписку отменённой. Храповик «не растёт» для
// путей, где тишина = потерянные деньги или заявка, — слишком мягкий: долг
// там не терпит отсрочки (правило №15 п.4, ложный долг и настоящий долг — разное).
//
// Поэтому для файлов, чей путь содержит subscri|donat|booking|payment, тихий
// catch запрещён целиком: счётчик >0 красит CI независимо от бейслайна, а
// запись такого файла в бейслайне тоже красная. Исключения — только в
// MONEY_ALLOW, с причиной; контрольный образец («такой же catch в соседнем
// файле того же пути по-прежнему красный») держит silent-catch.spec.ts.

export const MONEY_PATH = /(subscri|donat|booking|payment)/i;

export const MONEY_ALLOW = [
  // Разбор чужого календаря: нестандартный TZID («Russian Standard Time»)
  // бросает RangeError из Intl, разбор деградирует до floating-времени, а не
  // роняет все события календаря (fail-open, задокументировано в самом файле).
  // Действие пользователя тут не глотается — это не денежный отказ, а
  // деградация парсера.
  'src/booking/caldav-busy.ts',
];

/** Нарушения: тихий catch (или запись бейслайна) в денежном файле вне MONEY_ALLOW. */
export function moneyViolations(counts, baseline) {
  const bad = (file) => MONEY_PATH.test(file) && !MONEY_ALLOW.includes(file);
  const out = [];
  for (const [file, n] of Object.entries(counts)) {
    if (n > 0 && bad(file)) out.push(`${file}: ${n} тихих catch на денежном пути (допустимо 0, бейслайн не применяется)`);
  }
  for (const file of Object.keys(baseline)) {
    if (bad(file) && !(file in counts)) out.push(`${file}: запись бейслайна на денежном пути — удали её`);
  }
  return out;
}

/** Печатает нарушения и завершает процесс с кодом 1, если они есть. */
export function failOnMoneyPaths(counts, baseline) {
  const money = moneyViolations(counts, baseline);
  if (!money.length) return;
  console.error('❌ Тихий catch на денежном пути (бейслайна для них нет):\n');
  for (const m of money) console.error(`  ${m}`);
  process.exit(1);
}
