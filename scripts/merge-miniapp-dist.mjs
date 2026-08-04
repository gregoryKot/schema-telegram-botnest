#!/usr/bin/env node
// git merge driver для schema-miniapp/dist (.gitattributes → merge=miniapp-dist).
// Ставится в .git/config скриптом scripts/setup-merge-drivers.mjs.
//
// Зачем. dist мини-аппа коммитится в git (Dockerfile его только копирует, см.
// CLAUDE.md «Деплой webapp»), а CI-джоба `miniapp` требует, чтобы закоммиченный
// dist совпадал с исходником. Значит любые два агента, тронувшие исходник
// мини-аппа, конфликтуют гарантированно — index.html меняется всегда (ссылки
// на ассеты с контент-хешем), sw.js меняется всегда (precache-манифест).
//
// Строчного слияния тут не существует: это бандл, «взять кусок оттуда, кусок
// отсюда» даёт битый js. Правильный ответ для ЛЮБОГО файла в dist ровно один —
// «то, что получится из слитого исходника». Драйвер это и делает: не мержит,
// а пересобирает мини-апп и отдаёт git'у свежий файл.
//
// Вызов (git подставляет %A %P):
//   node scripts/merge-miniapp-dist.mjs %A %P
// %A — «наша» версия и файл, куда пишется результат; %P — путь в рабочем дереве.
//
// Сборка идёт ОДИН раз на всё слияние: git зовёт драйвер отдельно на каждый
// конфликтный файл (index.html, sw.js, …), поэтому результат сборки кладётся
// в кеш и последующие вызовы просто берут файл оттуда.
//
// Выход 1 (обычный конфликт остаётся человеку) — если сборка невозможна:
// в исходнике остались маркеры конфликта, не установлены зависимости, или
// сборка упала.
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'schema-miniapp', 'dist');
const [outPath, label = 'schema-miniapp/dist'] = process.argv.slice(2);

// Что участвует в сборке мини-аппа: его исходник и общий пакет shared.
const SOURCE_DIRS = ['schema-miniapp/src', 'shared/src'];
const SOURCE_FILES = [
  'schema-miniapp/index.html',
  'schema-miniapp/vite.config.ts',
  'schema-miniapp/package.json',
  'schema-miniapp/package-lock.json',
];

function bail(reason, hint) {
  console.error(`merge-miniapp-dist (${label}): ${reason}.`);
  if (hint) console.error(hint);
  console.error(
    'Конфликт оставлен как есть. Собери мини-апп вручную и заново сведи dist:\n' +
      '  npm run build --prefix schema-miniapp && git add -A schema-miniapp/dist',
  );
  process.exit(1);
}

/** Все файлы каталога рекурсивно, отсортированные — чтобы подпись была
 *  воспроизводимой между вызовами драйвера. */
function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function sourceFiles() {
  const files = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d)));
  for (const f of SOURCE_FILES) {
    const p = join(ROOT, f);
    if (existsSync(p)) files.push(p);
  }
  return files;
}

// Маркеры незавершённого слияния в исходнике. Собирать такое бессмысленно:
// vite упадёт (или, хуже, соберётся с мусором), поэтому проверяем до сборки
// и отдаём конфликт человеку с понятной причиной.
const CONFLICT_MARKER = /^(<{7}|>{7}) /m;

const files = sourceFiles();
const hash = createHash('sha256');
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  if (CONFLICT_MARKER.test(text)) {
    bail(
      `в исходнике остались маркеры конфликта (${relative(ROOT, f)})`,
      'Сначала сведи исходник мини-аппа, потом повтори слияние — dist соберётся из него.',
    );
  }
  hash.update(relative(ROOT, f).split(sep).join('/'));
  hash.update('\0');
  hash.update(text);
  hash.update('\0');
}
const signature = hash.digest('hex');

// Кеш живёт вне репозитория (в рабочем дереве идёт слияние — ничего лишнего
// туда класть нельзя) и привязан к пути репозитория, чтобы параллельные
// worktree/клоны не мешали друг другу.
const cacheDir = join(
  tmpdir(),
  `miniapp-dist-merge-${createHash('sha256').update(ROOT).digest('hex').slice(0, 12)}`,
);
const stampPath = join(cacheDir, 'stamp');
const cachedDist = join(cacheDir, 'dist');

function cacheIsFresh() {
  try {
    return readFileSync(stampPath, 'utf8').trim() === signature;
  } catch {
    return false;
  }
}

function rebuild() {
  if (!existsSync(join(ROOT, 'schema-miniapp', 'node_modules'))) {
    bail(
      'не установлены зависимости мини-аппа',
      'Поставь их и повтори слияние:\n  npm ci --prefix schema-miniapp',
    );
  }

  const res = spawnSync('npm', ['run', 'build', '--prefix', 'schema-miniapp'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    bail(
      'сборка мини-аппа упала',
      (res.stdout || '') + (res.stderr || '') || undefined,
    );
  }
  if (!existsSync(DIST)) bail('сборка не оставила schema-miniapp/dist');

  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });
  cpSync(DIST, cachedDist, { recursive: true });
  writeFileSync(stampPath, signature + '\n');

  // vite чистит outDir, поэтому ассеты «второй стороны» (со старым
  // контент-хешем) из рабочего дерева пропали — их удаление надо застейджить,
  // иначе в коммите останутся файлы, которых сборка больше не производит.
  console.error(
    'merge-miniapp-dist: мини-апп пересобран, dist сведён сборкой.\n' +
      'После слияния застейджи весь каталог целиком (в нём есть и удаления):\n' +
      '  git add -A schema-miniapp/dist',
  );
}

if (!cacheIsFresh()) rebuild();

const rel = relative(DIST, join(ROOT, label));
const built = join(cachedDist, rel);
if (rel.startsWith('..') || !existsSync(built) || !statSync(built).isFile()) {
  bail(
    `сборка больше не производит файл ${label}`,
    'Скорее всего он должен быть удалён — реши это вручную.',
  );
}

copyFileSync(built, outPath);
