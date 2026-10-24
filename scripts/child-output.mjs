// Вывод дочернего процесса в гейтах-храповиках (check-coverage-ratchet.mjs,
// check-frontend-coverage-ratchet.mjs): показать и не потерять хвост.
//
// Находка 2026-10-24 (PR #836, #843): jest пишет в лог 100–200 КБ, гейт
// выводил их через process.stdout.write и сразу делал process.exit. Когда
// stdout — pipe (так в GitHub Actions), запись асинхронна: до exit успевали
// уйти ~64 КБ, а хвост — блок FAIL, сводка jest и сообщение самого храповика —
// срезался. Шаг краснел с «206 PASS, 0 FAIL» и без причины. Поэтому выход
// из гейта — только через exitFlushed: он дожидается слива обоих потоков.

/** Выводит stdout/stderr дочернего процесса (результат spawnSync). */
export function relayOutput(res) {
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
}

/** process.exit после слива stdout и stderr: пустая запись с колбэком
 * срабатывает, когда все ранее поставленные в очередь записи ушли. */
export async function exitFlushed(code) {
  for (const stream of [process.stdout, process.stderr]) {
    await new Promise((resolve) => stream.write('', resolve));
  }
  process.exit(code);
}
