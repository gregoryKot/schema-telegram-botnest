#!/usr/bin/env node
// Селектор для мутаций изменённых файлов в PR-CI (не гейт: ничего не
// проверяет, только выбирает). Пересекает изменённые файлы со списком `mutate`
// золотого конфига Stryker и печатает пересечение через запятую (формат
// `stryker --mutate`). Пусто — печатает пустую строку, джоба PR-CI на этом
// зеленеет за секунды.
//
//   node scripts/mutation-changed-files.mjs --config=stryker.golden-auth.config.json --base=origin/main
//   node scripts/mutation-changed-files.mjs --config=... src/a.ts src/b.ts   # явный список
//
// Удалённые файлы отбрасываются: мутировать нечего. Шаблоны (`*`) в `mutate`
// не поддержаны намеренно — золотые конфиги перечисляют файлы поимённо.
import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Пересечение изменённых файлов со списком mutate конфига. */
export function selectMutated(mutate, changed) {
  const wanted = new Set(mutate);
  return [...new Set(changed)].filter((f) => wanted.has(f));
}

function main() {
  const args = process.argv.slice(2);
  const val = (n) =>
    args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const config = val('config');
  if (!config) {
    console.error('нужен --config=stryker.*.config.json');
    process.exit(2);
  }
  const base = val('base');
  const explicit = args.filter((a) => !a.startsWith('--'));
  const changed = base
    ? execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
        cwd: ROOT,
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean)
    : explicit;
  const mutate = JSON.parse(readFileSync(join(ROOT, config), 'utf8')).mutate;
  const picked = selectMutated(mutate, changed).filter((f) =>
    existsSync(join(ROOT, f)),
  );
  process.stdout.write(picked.join(','));
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
