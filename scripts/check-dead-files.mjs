#!/usr/bin/env node
// Гейт мёртвых файлов (правило №11 CLAUDE.md).
//
// Инцидент, из-за которого гейт появился: в репозитории лежали ДВА
// `prisma-exception.filter.ts` — живой (`src/prisma`, зарегистрирован в
// `main.ts`) и его старая копия в `src/filters`, на которую никто не ссылался.
// Копия выглядела рабочим кодом, и первый же, кто взялся её улучшать, написал
// тест на мёртвый файл — работа ушла в код, которого для пользователя нет.
// Хуже другое: правка «починил обработку ошибок», внесённая в мёртвую копию,
// читается как сделанная, а на проде ничего не меняется.
//
// Проверка простая: у каждого файла должен быть хотя бы один потребитель среди
// НЕ-тестовых файлов. Тесты в потребители не годятся — файл, который
// импортирует только его собственный спек, и есть мёртвый код (ровно случай
// выше: спек на мёртвый фильтр был зелёным).
//
// Считаем сразу по всем деревьям (бэкенд, оба фронтенда, shared): фронтенды
// импортируют shared относительными путями, поэтому пофайловый разбор одного
// пакета показал бы весь shared «мёртвым».
//
//   node scripts/check-dead-files.mjs            # проверка
//   node scripts/check-dead-files.mjs --update   # зафиксировать список
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'dead-files-baseline.json');
const update = process.argv.includes('--update');

const TREES = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];
const CODE = /\.(ts|tsx)$/;
const TEST = /\.(spec|test)\.(ts|tsx)$/;

/**
 * Тестовая инфраструктура (фейки, фикстуры, песочницы) по определению живёт
 * ради тестов — требовать ей потребителя в проде бессмысленно. Исключаем по
 * расположению и имени, а не поштучно: иначе каждый новый хелпер пришлось бы
 * заносить в бейслайн руками, и он превратился бы в свалку.
 */
const isTestInfra = (rel) =>
  rel.includes('/test-support/') ||
  rel.includes('.test-helpers.') ||
  rel.includes('.fixture.') ||
  /Mock\.tsx?$/.test(rel);

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (CODE.test(full) && !full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const all = TREES.filter((t) => existsSync(join(ROOT, t))).flatMap((t) =>
  listFiles(join(ROOT, t)),
);
const production = all.filter((f) => !TEST.test(f));

const IMPORT_RE =
  /(?:from\s+['"](\.[^'"]+)['"])|(?:require\(['"](\.[^'"]+)['"]\))|(?:import\(['"](\.[^'"]+)['"]\))/g;

const consumed = new Set();
for (const file of production) {
  const text = readFileSync(file, 'utf8');
  for (let m = IMPORT_RE.exec(text); m !== null; m = IMPORT_RE.exec(text)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const target = resolve(dirname(file), spec).replace(CODE, '');
    consumed.add(target);
    // `import './dir'` резолвится в `./dir/index.tsx` — учитываем обе формы,
    // иначе index-файлы посчитались бы мёртвыми.
    consumed.add(join(target, 'index'));
  }
}

const orphans = production
  .filter((f) => !consumed.has(f.replace(CODE, '')))
  .map((f) => relative(ROOT, f))
  .filter((rel) => !isTestInfra(rel))
  .sort();

if (update) {
  const base = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8'))
    : {};
  const next = {};
  for (const f of orphans) next[f] = base[f] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${orphans.length} файлов без потребителя.`);
  for (const f of orphans) console.log(`   ${f}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `❌ нет бейслайна ${BASELINE} — зафиксируй текущее состояние:\n` +
      '   node scripts/check-dead-files.mjs --update',
  );
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(Object.keys(base));
const fresh = orphans.filter((f) => !known.has(f));
const goneButListed = [...known].filter((f) => !orphans.includes(f));
const noReason = Object.entries(base).filter(([, why]) => String(why).length < 20);

const problems = [];
if (fresh.length > 0) {
  problems.push(
    'файлы без единого потребителя в прод-коде (мёртвый код или забытый импорт):',
    ...fresh.map((f) => `   ${f}`),
  );
}
if (goneButListed.length > 0) {
  problems.push(
    'записи бейслайна протухли — файл удалён или у него появился потребитель:',
    ...goneButListed.map((f) => `   ${f}`),
  );
}
if (noReason.length > 0) {
  problems.push(
    'исключение без внятной причины (следующий редактор не поймёт, можно ли удалять):',
    ...noReason.map(([f]) => `   ${f}`),
  );
}

if (problems.length > 0) {
  console.error('❌ гейт мёртвых файлов:');
  for (const p of problems) console.error(p);
  console.error(
    'Файл никто не импортирует — значит, для пользователя его нет. Удали его\n' +
      'в этом же PR (заменил компонент новой версией — старую убираем сразу),\n' +
      'либо подключи, либо, если отсутствие потребителя осознано (точка входа,\n' +
      'реестр для спека-сверки), впиши причину:\n' +
      '   node scripts/check-dead-files.mjs --update',
  );
  process.exit(1);
}

console.log(
  `✓ гейт мёртвых файлов: ${production.length} файлов, ` +
    `без потребителя — только ${orphans.length} известных (точки входа и реестры).`,
);
