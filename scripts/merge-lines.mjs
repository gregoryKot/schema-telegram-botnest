#!/usr/bin/env node
// Merge-драйвер git для файлов-реестров строк (docs/BACKLOG.md):
//   node scripts/merge-lines.mjs %O %A %B %P
// Свелось — результат в %A, выход 0. Одну строку стороны переписали
// по-разному — в %A обычные маркеры конфликта (git merge-file), выход 1.
// Правила слияния — scripts/merge-lines-core.mjs.
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { mergeLines } from './merge-lines-core.mjs';

const [oPath, aPath, bPath, label = 'файл'] = process.argv.slice(2);
if (!oPath || !aPath || !bPath) {
  console.error('merge-lines: ожидаются пути %O %A %B [%P]');
  process.exit(2);
}

const read = (path) => readFileSync(path, 'utf8').split('\n');
const result = mergeLines(read(oPath), read(aPath), read(bPath));
if (result.lines) {
  writeFileSync(aPath, result.lines.join('\n'));
  process.exit(0);
}
console.error(
  `merge-lines: ${label} — строку ${result.conflict} базы стороны переписали по-разному, сведи руками`,
);
spawnSync('git', [
  'merge-file',
  '-L',
  'ours',
  '-L',
  'base',
  '-L',
  'theirs',
  aPath,
  oPath,
  bPath,
]);
process.exit(1);
