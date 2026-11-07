#!/usr/bin/env node
// Гейт имён файлов: два отслеживаемых пути не могут различаться только
// регистром. Родился из инцидента 2026-11-05: в `shared/src/therapy/
// conceptGraph/diagram/` рядом лежали `diagramEdges.ts` (модель, `buildEdges`)
// и `DiagramEdges.tsx` (компонент). На macOS файловая система нечувствительна
// к регистру, и Vite разрешил `import { DiagramEdges } from './DiagramEdges'`
// в `diagramEdges.ts` — «does not provide an export named 'DiagramEdges'»,
// весь кабинет терапевта падал в error boundary в локальном dev. На Linux
// (CI, прод) файловая система различает регистр, поэтому ни один гейт и ни
// один тест этого не видели: поломка жила только на машинах разработчиков.
// Пять таких пар переименованы в `*Model.ts`.
//
// Сравниваются пути целиком без учёта регистра, а также пути БЕЗ расширения:
// `dir/name.ts` и `dir/Name.tsx` — тоже коллизия, потому что голый импорт
// `./Name` Vite разрешает по первому совпавшему расширению.
//
// Абсолютный запрет без бейслайна и без --update: класс вычищен целиком,
// замораживать нечего (правило №15).
//
// Источник файлов — `git ls-files`. Для теста: `--list <файл>` читает пути
// построчно (на macOS в песочнице нельзя создать `foo.ts` и `FOO.ts` рядом).
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');

// Каталоги и деревья, которые гейт не смотрит: сторонний код и удалённый
// мини-апп (если остался в дереве).
const SKIP = /(^|\/)(node_modules|schema-miniapp)\//;

function listFiles(argv) {
  const i = argv.indexOf('--list');
  const raw =
    i >= 0
      ? readFileSync(resolve(ROOT, argv[i + 1]), 'utf8')
      : execFileSync('git', ['ls-files'], {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        });
  return raw.split('\n').filter((p) => p && !SKIP.test(p));
}

/** Группы путей, совпадающих без учёта регистра (с расширением или без). */
export function findCollisions(files) {
  const byFull = new Map();
  const byStem = new Map();
  const add = (map, key, path) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(path);
  };
  for (const p of files) {
    add(byFull, p.toLowerCase(), p);
    add(byStem, p.replace(/\.[^./]+$/, '').toLowerCase(), p);
  }
  const groups = new Map();
  for (const map of [byFull, byStem]) {
    for (const set of map.values()) {
      // Группа — это разные пути, которые различаются именно регистром
      // (разные расширения при одинаковом регистре — законны: a.ts и a.css).
      const cased = [...set];
      const stems = new Set(cased.map((p) => p.replace(/\.[^./]+$/, '')));
      if (cased.length > 1 && stems.size > 1) {
        groups.set([...set].sort().join('|'), [...set].sort());
      }
    }
  }
  return [...groups.values()];
}

function main() {
  const collisions = findCollisions(listFiles(process.argv.slice(2)));
  if (collisions.length === 0) {
    console.log('✓ имена файлов: пар, различающихся только регистром, нет');
    return;
  }
  console.error(
    `✗ ${collisions.length} групп(ы) путей различаются только регистром:`,
  );
  for (const g of collisions) {
    console.error('  - ' + g.join('  ≈  '));
  }
  console.error(
    '\nНа macOS (регистронезависимая ФС) Vite разрешит `./Name` в `name.ts`,' +
      '\nа не в `Name.tsx` — кабинет падает в error boundary только локально.' +
      '\nПереименуй модель/хук так, чтобы имя отличалось не регистром' +
      '\n(например `diagramEdgesModel.ts` рядом с `DiagramEdges.tsx`).',
  );
  process.exit(1);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
