// Спек, оставивший process.exitCode, краснеет сам — а не весь прогон молча.
//
// Класс (ночной прогон 2026-10-15, после ci-alarm #672): Telegraf без
// `bot.catch` на ошибке хендлера ставит `process.exitCode = 1`
// (node_modules/telegraf/lib/telegraf.js, handleError). В воркере это гибнет
// вместе с воркером, а в одном процессе (`--detectOpenHandles` в nightly) —
// код выхода самого jest: все сьюты зелёные, код 1, ни строки причины.
// Ищется только перебором спеков, поэтому ловим на месте: setupFilesAfterEnv
// (exit-code-leak.setup.ts) сверяет код после каждого файла.

/**
 * Если с начала файла кто-то выставил ненулевой process.exitCode — сбросить
 * его к прежнему (следующие файлы и сам jest не наследуют) и вернуть текст
 * ошибки для файла-виновника; иначе null.
 */
export function takeLeakedExitCode(
  before: string | number | null | undefined,
): string | null {
  const code = process.exitCode;
  if (code === before || code === undefined || code === null || code === 0) {
    return null;
  }
  process.exitCode = before ?? undefined;
  return (
    `спек оставил process.exitCode = ${code}: в одном процессе ` +
    '(--detectOpenHandles в nightly) это код выхода всего jest при зелёных ' +
    'тестах. Частая причина — Telegraf без bot.catch (handleError ставит ' +
    'exitCode = 1): боту в тесте нужен свой bot.catch. Код сброшен.'
  );
}
