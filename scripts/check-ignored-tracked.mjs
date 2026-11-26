#!/usr/bin/env node
// Индекс против .gitignore: отслеживаемый файл, который .gitignore запрещает.
//
// `.gitignore` не снимает уже отслеживаемое: правило, появившееся после
// файлов, молча ничего не делает. Так в репозитории жили 466 файлов
// `test/.jest-cache` (кэш ts-jest, добавлен в #243, правило `.jest-cache/`
// пришло в #624): локальный прогон переписывал их, и каждый `git status`
// показывал шумный дифф, а в `.map` лежала вторая копия `src`.
//
// Берутся только правила `.gitignore` из репозитория (`--exclude-per-directory`),
// а не `--exclude-standard`: тот подмешивает глобальный `core.excludesFile`
// и `.git/info/exclude` разработчика, и у агента с глобальным игнором `*.log`
// гейт краснел бы на законно отслеживаемых файлах.
//
// Бейслайна и `--update` нет: класс вычищен целиком. Файл, который нужно
// держать под общим игнор-правилом, оформляется отрицанием `!путь` в самом
// `.gitignore`, а не списком исключений здесь.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOW = 20;

export function ignoredTracked(root = ROOT) {
  const res = spawnSync(
    'git',
    ['ls-files', '-z', '-c', '-i', '--exclude-per-directory=.gitignore'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.status !== 0) {
    throw new Error(`git ls-files упал: ${res.stderr || res.error}`);
  }
  return res.stdout.split('\0').filter(Boolean);
}

function main() {
  const files = ignoredTracked();
  if (files.length === 0) {
    console.log('✓ отслеживаемых файлов под .gitignore: ни одного');
    return;
  }
  console.error(
    `✗ ${files.length} отслеживаемых файлов, которые запрещает .gitignore:`,
  );
  for (const f of files.slice(0, SHOW)) console.error(`  ${f}`);
  if (files.length > SHOW) console.error(`  … и ещё ${files.length - SHOW}`);
  console.error(
    '\nПравило .gitignore отслеживаемые файлы не снимает. Снять с учёта,' +
      '\nоставив на диске: git rm -r --cached <путь>. Если файл должен' +
      '\nлежать в репозитории — добавь в .gitignore отрицание `!<путь>`.',
  );
  process.exitCode = 1;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
