#!/usr/bin/env node
// Байт-храповик размера бандлов (аудит 2026-07, пункт №5). Сборка webapp
// уже печатает предупреждение «chunks larger than 400 kB» — и оно молча
// игнорируется: никто не читает лог успешной сборки. Гейт по образцу
// check-file-size-ratchet.mjs (пофайловый храповик), но меряет БАЙТЫ
// собранных артефактов, а не строки исходников.
//
// Ключи бейслайна намеренно НЕ по именам файлов: у vite чанки webapp несут
// контент-хеш в имени (vendor-react-AlMO7SB-.js) — при любой правке хеш
// меняется, и построчный бейслайн по имени файла конфликтовал бы у каждого
// PR. Вместо этого — агрегаты:
//   webapp:total-js       — сумма байт всех webapp/dist/assets/*.js
//   webapp:largest-chunk  — байт самого тяжёлого JS-чанка webapp
//   miniapp:index.js      — байт schema-miniapp/dist/assets/index.js
//                            (имя БЕЗ хеша — правило №13 CLAUDE.md, поэтому
//                            здесь ключ = реальное имя файла, это осознанно)
//   miniapp:total-js      — сумма байт всех schema-miniapp/dist/assets/*.js
//
//   node scripts/check-bundle-size-ratchet.mjs            # проверка
//   node scripts/check-bundle-size-ratchet.mjs --update   # зафиксировать
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'bundle-size-baseline.json');
const UPDATE = process.argv.includes('--update');

// Допуск на шум пересборки (esbuild/rollup на другой ОС даёт побайтово
// идентичный вывод почти всегда, но не гарантированно — минификатор может
// вставить дополнительный перевод строки/иначе округлить исходный source
// map). ±512 байт — меньше одной строки минифицированного кода, но
// достаточно, чтобы не флеймить CI на шум.
const TOLERANCE_BYTES = 512;

/** Байты всех *.js в каталоге (без рекурсии — assets/ у обеих сборок плоский). */
function jsFiles(dir) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, bytes: statSync(join(dir, f)).size }));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const webappDir = join(ROOT, 'webapp', 'dist', 'assets');
  const webappFiles = jsFiles(webappDir);
  if (webappFiles === null) {
    fail(
      '❌ бандл-храповик: webapp/dist не собран — гейт меряет реальную сборку,\n' +
        'а не исходники (webapp/dist в git не хранится, правило CLAUDE.md).\n' +
        'Сначала собери: cd webapp && node_modules/.bin/vite build\n' +
        'В CI шаг стоит сразу после сборки webapp — если видишь эту ошибку там,\n' +
        'порядок шагов в .github/workflows/ci.yml сломан.',
    );
  }
  if (webappFiles.length === 0) {
    fail('❌ бандл-храповик: webapp/dist/assets пуст — сборка не дала ни одного JS-файла.');
  }

  const miniappDir = join(ROOT, 'schema-miniapp', 'dist', 'assets');
  const miniappFiles = jsFiles(miniappDir);
  if (miniappFiles === null) {
    fail(
      '❌ бандл-храповик: schema-miniapp/dist/assets не найден — dist мини-аппа\n' +
        'коммитится в git (правило деплоя CLAUDE.md), каталог обязан быть в дереве.\n' +
        'Пересобери: npm run build --prefix schema-miniapp',
    );
  }
  const miniappIndex = miniappFiles.find((f) => f.name === 'index.js');
  if (!miniappIndex) {
    fail(
      '❌ бандл-храповик: schema-miniapp/dist/assets/index.js не найден.\n' +
        'Ассеты мини-аппа именуются БЕЗ хеша (правило №13 CLAUDE.md, vite.config.ts) —\n' +
        'ожидается файл с этим именем. Пересобери: npm run build --prefix schema-miniapp',
    );
  }

  const webappTotal = webappFiles.reduce((s, f) => s + f.bytes, 0);
  const webappLargest = webappFiles.reduce((m, f) => (f.bytes > m.bytes ? f : m));
  const miniappTotal = miniappFiles.reduce((s, f) => s + f.bytes, 0);

  const metrics = {
    'webapp:total-js': webappTotal,
    'webapp:largest-chunk': webappLargest.bytes,
    'miniapp:index.js': miniappIndex.bytes,
    'miniapp:total-js': miniappTotal,
  };
  // Только для человекочитаемого вывода — в бейслайн не идёт (имя чанка
  // webapp несёт хеш и меняется при каждой правке, см. шапку файла).
  const context = {
    'webapp:largest-chunk': webappLargest.name,
  };

  const kb = (n) => (n / 1024).toFixed(1);

  if (UPDATE) {
    const sorted = Object.fromEntries(
      Object.entries(metrics).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log('Бейслайн бандлов обновлён:');
    for (const [key, bytes] of Object.entries(sorted)) {
      const label = context[key] ? ` (${context[key]})` : '';
      console.log(`   ${key}: ${kb(bytes)} КБ${label}`);
    }
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    fail(
      'Нет бейслайна — сгенерируй: node scripts/check-bundle-size-ratchet.mjs --update',
    );
  }

  const grown = [];
  const shrunk = [];
  for (const [key, bytes] of Object.entries(metrics)) {
    const was = baseline[key];
    if (typeof was !== 'number') continue; // новый ключ — просто нет с чем сравнивать
    if (bytes > was + TOLERANCE_BYTES) grown.push({ key, was, now: bytes });
    else if (bytes < was - TOLERANCE_BYTES) shrunk.push({ key, was, now: bytes });
  }

  if (grown.length) {
    console.error('❌ бандл-храповик: бандл вырос сверх зафиксированного размера:');
    for (const { key, was, now } of grown) {
      const label = context[key] ? ` (${context[key]})` : '';
      console.error(
        `   ${key}: ${kb(was)} КБ → ${kb(now)} КБ (+${kb(now - was)} КБ)${label}`,
      );
    }
    console.error(
      'Раздутый бандл дробится (динамический import()/React.lazy(), вынос\n' +
        'редко используемого кода в отдельный чанк), а не растёт дальше молча.\n' +
        'Если рост неизбежен и осознан — зафиксируй:\n' +
        '  node scripts/check-bundle-size-ratchet.mjs --update',
    );
    process.exit(1);
  }

  const lines = [];
  for (const [key, bytes] of Object.entries(metrics)) {
    const label = context[key] ? ` (${context[key]})` : '';
    lines.push(`   ${key}: ${kb(bytes)} КБ${label}`);
  }
  console.log(lines.join('\n'));

  if (shrunk.length) {
    console.log(
      `✓ бандл-храповик: без роста, ${shrunk.length} метрик(и) уменьшились — зафиксируй прогресс:\n` +
        '  node scripts/check-bundle-size-ratchet.mjs --update',
    );
  } else {
    console.log('✓ бандл-храповик: без роста');
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
