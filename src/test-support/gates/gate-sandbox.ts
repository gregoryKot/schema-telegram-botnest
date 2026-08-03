// Общий хелпер для тестов CI-гейтов (scripts/*.mjs). Гейты — единственная
// защита от регрессов правил CLAUDE.md, но сами были без единого теста:
// сломанный гейт не краснеет — он молча пропускает всё, и мы считаем, что
// защита есть, хотя её нет. Хелпер запускает реальный скрипт из scripts/
// (не копию логики) в изолированной песочнице на fixture-файлах, чтобы
// проверить его поведение как чёрный ящик — так же, как его вызывает CI.
//
// Скрипты берут ROOT от собственного расположения
// (`dirname(fileURLToPath(import.meta.url))/..`), поэтому достаточно
// скопировать реальный scripts/<name>.mjs в `<tmp>/scripts/<name>.mjs` —
// скрипт сам решит, что ROOT = <tmp>, и будет читать/писать fixture-файлы
// внутри песочницы, не касаясь настоящего репозитория.
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';

// src/test-support/gates → корень репозитория на 3 уровня выше.
const REAL_SCRIPTS_DIR = join(__dirname, '..', '..', '..', 'scripts');

export interface GateResult {
  status: number | null;
  stdout: string;
  stderr: string;
  /** Путь к песочнице. Валиден только если вызван с { keepTmp: true } —
   * иначе каталог уже удалён к моменту возврата. */
  tmp: string;
}

export interface RunGateOptions {
  /** Аргументы командной строки скрипту (напр. ['--update']). */
  args?: string[];
  /** Инициализировать git-репозиторий и застейджить fixture-файлы —
   * нужно гейтам, читающим состав файлов через `git ls-files`
   * (check-file-size-ratchet.mjs, check-weak-assert-ratchet.mjs). */
  git?: boolean;
  /** Не удалять песочницу после прогона — нужно, чтобы проверить, что
   * записал `--update` (baseline-файл появляется уже ПОСЛЕ запуска). Вызывающий
   * тест обязан сам вызвать cleanupTmp(tmp) в конце. */
  keepTmp?: boolean;
  /** Полностью заменяет process.env дочернего процесса (напр. чтобы
   * подсунуть фейковый `npx` через PATH — см. makeFakeNpx). */
  env?: Record<string, string>;
  /** Хук после записи fixture-файлов и до запуска скрипта — для вещей,
   * которые не выразить как relPath→content (создать директорию-заглушку
   * под vitest-пакет и т.п.). */
  setup?: (tmp: string) => void;
}

/** Удаляет песочницу, оставленную runGate({ keepTmp: true }). */
export function cleanupTmp(tmp: string): void {
  rmSync(tmp, { recursive: true, force: true });
}

/**
 * Копирует реальный scripts/<scriptName> в свежую песочницу, записывает туда
 * fixture-файлы (`files`: relPath → content), опционально инициализирует git,
 * запускает `node <tmp>/scripts/<scriptName> ...args` и возвращает результат.
 */
export function runGate(
  scriptName: string,
  files: Record<string, string>,
  options: RunGateOptions = {},
): GateResult {
  const tmp = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    const scriptsDir = join(tmp, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    copyFileSync(
      join(REAL_SCRIPTS_DIR, scriptName),
      join(scriptsDir, scriptName),
    );

    for (const [relPath, content] of Object.entries(files)) {
      const dest = join(tmp, relPath);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content);
    }

    options.setup?.(tmp);

    if (options.git) {
      spawnSync('git', ['init', '-q'], { cwd: tmp });
      spawnSync('git', ['add', '-A'], { cwd: tmp });
    }

    const res = spawnSync(
      'node',
      [join(scriptsDir, scriptName), ...(options.args ?? [])],
      {
        cwd: tmp,
        encoding: 'utf8',
        env: options.env,
        maxBuffer: 64 * 1024 * 1024,
      },
    );

    return {
      status: res.status,
      stdout: res.stdout ?? '',
      stderr: res.stderr ?? '',
      tmp,
    };
  } finally {
    if (!options.keepTmp) rmSync(tmp, { recursive: true, force: true });
  }
}

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
 */
export function makeFakeNpx(): { binDir: string; cleanup: () => void } {
  const binDir = mkdtempSync(join(tmpdir(), 'fakenpx-'));
  const script = [
    '#!/bin/sh',
    'if [ -z "$FAKE_NPX_SUMMARY" ]; then',
    '  exit 0',
    'fi',
    'mkdir -p coverage',
    'printf \'%s\' "$FAKE_NPX_SUMMARY" > coverage/coverage-summary.json',
    'exit 0',
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

/** `n` строк вида `line 1\nline 2\n...\nline n` без завершающего перевода
 * строки — так gate-скрипты (countLines) посчитают ровно `n` строк. */
export function linesOfLength(n: number, prefix = 'export const x = '): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i};`).join('\n');
}
