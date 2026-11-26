// Чтение дерева для гейта check-agent-docs.mjs: списки *.md, каталоги верхнего
// уровня и подкаталоги модулей. Вынесено из движка (правило №10). Только fs,
// ни git, ни зависимостей: «что лежит в дереве» — это то, что лежит на диске.
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { SKIP_SUB, SKIP_TOP } from './agent-docs-rules.mjs';

export const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
export const exists = (root, rel) => existsSync(join(root, rel));
export const isDir = (abs) => existsSync(abs) && statSync(abs).isDirectory();

/** *.md в каталоге (относительные пути с `/`); `deep` — со вложенными. */
export function listMd(root, dir, deep = false, skip = SKIP_SUB) {
  const abs = join(root, dir);
  if (!isDir(abs)) return [];
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory() && deep && !skip.has(e.name)) out.push(...listMd(root, rel, true, skip));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(rel);
  }
  return out.sort();
}

/** Есть ли под каталогом хоть один файл (пустой каталог git не хранит). */
function hasFiles(abs) {
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.isFile()) return true;
    if (e.isDirectory() && !SKIP_SUB.has(e.name) && hasFiles(join(abs, e.name))) return true;
  }
  return false;
}

/** Прямые подкаталоги без dot-каталогов, мусора сборки и пустых. */
export function subdirs(root, dir, skip) {
  const abs = join(root, dir);
  if (!isDir(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !skip.has(e.name))
    .filter((e) => hasFiles(join(abs, e.name)))
    .map((e) => e.name)
    .sort();
}

/** Простые записи `.gitignore` про каталог верхнего уровня (`reports/`,
 *  `/test-results`): git их не хранит, карте о них знать незачем. */
function gitignoredTop(root) {
  if (!exists(root, '.gitignore')) return new Set();
  const names = read(root, '.gitignore')
    .split('\n')
    .map((l) => l.trim().match(/^\/?([\w][\w.-]*)\/?$/)?.[1])
    .filter(Boolean);
  return new Set(names);
}

/** Каталоги верхнего уровня, о которых карта обязана знать. */
export function topLevelDirs(root) {
  return subdirs(root, '.', new Set([...SKIP_TOP, ...gitignoredTop(root)]));
}
