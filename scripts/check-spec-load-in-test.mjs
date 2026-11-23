#!/usr/bin/env node
// Гейт «спек над мутационной зоной не грузит модули внутри теста».
//
// Stryker (coverageAnalysis: perTest) засчитывает тесту весь код, исполненный
// между его началом и концом. Модуль, загруженный внутри `it` (`require`,
// `loadWithKeys`, `jest.isolateModules`), исполняет там свой код уровня модуля:
// статический мутант получает «покрывающий тест», статика зоны становится
// гибридной и мутационный счёт файла проседает без единой правки в нём
// (`merge.service.ts` — до 52.94). Загрузка в `beforeAll` и на уровне файла —
// вне теста: статика остаётся статикой. `beforeEach` не годится: jest-circus
// шлёт `test_start` до его хуков, Stryker засчитывает их тесту.
//
// Исключение — тест, чей предмет сама загрузка модуля (разбор env, бросок при
// импорте, несбрасываемое состояние модуля): `loadAsSubject('причина', () => …)`
// из src/test-support/load-as-subject.ts прямо в тесте, причина — непустой литерал.
//
// Что ловит в `src/**/*.spec.ts`, чей граф импортов доходит до файла из
// `mutate` любого stryker*.config.json: внутри `it(`/`test(` — относительный
// `require('./…')`/`import('./…')`, `loadWithKeys(`, `jest.isolateModules(` и
// вызов функции спека, которая делает это сама или через другую такую же.
// Разбор — в spec-load-in-test-rules.mjs. Долг заморожен в
// scripts/spec-load-in-test-baseline.json (спек → число загрузок в тестах):
// счётчик только убывает, нового спека в нём не бывает; `--update` пишет
// только уменьшение.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { findLoadsInTests } from './spec-load-in-test-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'spec-load-in-test-baseline.json');
const IMPORT_RE = /(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;

function walk(dir, out = []) {
  if (!existsSync(join(ROOT, dir))) return out;
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.spec\.ts$/.test(e.name)) out.push(rel);
  }
  return out;
}

/** Зона: объединение `mutate` всех конфигов Stryker в корне. */
function readZone() {
  const zone = new Set();
  for (const f of readdirSync(ROOT)) {
    if (!/^stryker.*\.json$/.test(f)) continue;
    for (const m of JSON.parse(readFileSync(join(ROOT, f), 'utf8')).mutate ?? []) zone.add(m);
  }
  return zone;
}

const importsOf = new Map();
/** Относительные импорты файла, разрешённые в существующие .ts/.tsx. */
function localImports(rel) {
  if (importsOf.has(rel)) return importsOf.get(rel);
  const found = [];
  for (const m of readFileSync(join(ROOT, rel), 'utf8').matchAll(IMPORT_RE)) {
    const base = normalize(join(dirname(rel), m[1])).split('\\').join('/');
    const hit = ['.ts', '.tsx', '/index.ts'].find((tail) => existsSync(join(ROOT, base + tail)));
    if (hit) found.push(base + hit);
  }
  importsOf.set(rel, found);
  return found;
}

/** Первый файл зоны в графе импортов спека; нет — null. */
function zoneFileOf(spec, zone) {
  const seen = new Set([spec]);
  const queue = [spec];
  while (queue.length) {
    for (const next of localImports(queue.shift())) {
      if (zone.has(next)) return next;
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return null;
}

function main() {
  const zone = readZone();
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
  const problems = [];
  const next = {};
  let inScope = 0;
  for (const spec of walk('src')) {
    const raw = readFileSync(join(ROOT, spec), 'utf8');
    if (!/\brequire\s*\(|\bloadWithKeys\s*\(|\bisolateModules|\bimport\s*\(/.test(raw)) continue;
    const zoneFile = zoneFileOf(spec, zone);
    if (!zoneFile) continue;
    inScope += 1;
    const found = findLoadsInTests(stripComments(raw));
    const allowed = baseline[spec] ?? 0;
    if (found.length) next[spec] = Math.min(found.length, allowed);
    if (found.length <= allowed) continue;
    problems.push(`${spec}: загрузок в тестах ${found.length}, в бейслайне ${allowed} (зона: ${zoneFile})`);
    for (const v of found) problems.push(`   L${v.line}: ${v.what}`);
  }
  if (problems.length) {
    console.error('❌ Спек над мутационной зоной грузит модуль внутри теста:\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nКод уровня модуля, исполненный внутри `it`, Stryker засчитывает этому тесту —\n' +
        'статика зоны становится гибридной, счёт файла падает. Перенеси загрузку в\n' +
        '`beforeAll` или на уровень файла (не в `beforeEach`: его хуки Stryker тоже\n' +
        'засчитывает тесту), тест пусть берёт готовый модуль. Предмет теста — сама\n' +
        "загрузка? Оберни её в тесте: `loadAsSubject('причина', () => …)`.\n" +
        'Бейслайн вверх не правится: `--update` записывает только уменьшение.',
    );
    process.exit(1);
  }
  const shrunk = Object.keys(baseline).filter((k) => (next[k] ?? 0) < baseline[k]);
  if (process.argv.includes('--update') && shrunk.length) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, Object.keys(next).sort(), 2)}\n`);
  }
  const debt = Object.values(next).reduce((a, b) => a + b, 0);
  const hint = shrunk.length && !process.argv.includes('--update') ? ` Усохло ${shrunk.length} — зафиксируй: --update.` : '';
  console.log(`✓ загрузка модулей в спеках над мутационной зоной: спеков с загрузчиком ${inScope}, долг ${debt} в ${Object.keys(next).length}.${hint}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
