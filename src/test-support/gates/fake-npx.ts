// Фейковый `npx` для тестов гейтов-храповиков (песочница — gate-sandbox.ts).
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Создаёт фейковый бинарь `npx` для гейтов, которые сами запускают
 * `npx jest --coverage` / `npx vitest run --coverage`
 * (check-coverage-ratchet.mjs, check-frontend-coverage-ratchet.mjs).
 * Поднимать настоящий jest/vitest в песочнице не нужно и дорого — гейт
 * проверяется как читатель coverage-summary.json, а не как раннер тестов.
 *
 * Фейк ничего не знает про переданные ему аргументы: он смотрит на
 * env FAKE_NPX_SUMMARY (JSON-строка) и, если она задана, пишет её в
 * `<cwd>/coverage/coverage-summary.json` (cwd — то, что передал гейт-скрипт
 * через spawnSync({cwd})), имитируя успешный прогон с отчётом. Если
 * переменная не задана — эмулирует прогон, который отчёта не оставил.
 *
 * Объёмный лог и код возврата: FAKE_NPX_NOISE_KB=N печатает по N КБ «логов
 * Nest» и в stdout, и в stderr, а в конце каждого потока — хвостовой маркер
 * (NPX_TAIL_STDOUT / NPX_TAIL_STDERR); FAKE_NPX_EXIT=K завершает фейк с кодом
 * K (упавший jest). Нужно, чтобы проверить, что гейт не теряет хвост вывода
 * дочернего процесса при чтении через pipe (находка 2026-10-24).
 */
export function makeFakeNpx(): { binDir: string; cleanup: () => void } {
  const binDir = mkdtempSync(join(tmpdir(), 'fakenpx-'));
  const script = [
    '#!/bin/sh',
    'if [ -n "$FAKE_NPX_NOISE_KB" ]; then',
    '  yes "nest log line ................................" | head -c $((FAKE_NPX_NOISE_KB * 1024))',
    '  yes "nest warn line ..............................." | head -c $((FAKE_NPX_NOISE_KB * 1024)) >&2',
    '  printf "\\nNPX_TAIL_STDOUT\\n"',
    '  printf "\\nNPX_TAIL_STDERR\\n" >&2',
    'fi',
    'if [ -z "$FAKE_NPX_SUMMARY" ]; then',
    '  exit "${FAKE_NPX_EXIT:-0}"',
    'fi',
    'mkdir -p coverage',
    'printf \'%s\' "$FAKE_NPX_SUMMARY" > coverage/coverage-summary.json',
    'exit "${FAKE_NPX_EXIT:-0}"',
    '',
  ].join('\n');
  const npxPath = join(binDir, 'npx');
  writeFileSync(npxPath, script);
  chmodSync(npxPath, 0o755);
  return {
    binDir,
    cleanup: () => rmSync(binDir, { recursive: true, force: true }),
  };
}
