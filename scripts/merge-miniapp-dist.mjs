#!/usr/bin/env node
// Слияние schema-miniapp/dist — сборкой, а не построчно.
// Два режима, оба ставит scripts/setup-merge-drivers.mjs:
//   node scripts/merge-miniapp-dist.mjs %A %P   — git merge driver
//                                                 (.gitattributes → merge=miniapp-dist)
//   node scripts/merge-miniapp-dist.mjs --after-merge — хук .git/hooks/post-merge
//
// Зачем. dist мини-аппа коммитится в git (Dockerfile его только копирует, см.
// CLAUDE.md «Деплой webapp»), поэтому у каждой пары PR, тронувших исходник,
// расходятся assets/index.js и sw.js. Построчно бандл не сводится: «кусок
// оттуда, кусок отсюда» даёт битый js, и разрешать такой конфликт руками
// нечего и незачем — правильный ответ для любого файла в dist ровно один,
// «то, что получится из слитого исходника».
//
// Почему драйвер НЕ собирает сам. Собирать внутри слияния нельзя: git зовёт
// драйвер, когда слитый исходник ещё не дописан в рабочее дерево. Проверено
// вживую — сборка взяла App.tsx без правки второй стороны, и в прекэше sw.js
// оказалась revision чужого бандла при том, что сам assets/index.js git взял
// от второй стороны. Молча разъехавшийся прекэш хуже конфликта.
//
// Поэтому обязанности разделены:
//   драйвер   — гасит конфликт (оставляет «нашу» версию, слияние доходит до
//               конца без маркеров в бандле) и говорит, что будет дальше;
//   post-merge — сразу после слияния пересобирает мини-апп и стейджит dist.
// Подстраховка на случай, если хук не сработал (слияние с конфликтами в
// исходнике, чужая машина без установки) — CI-джоба `miniapp`: она роняет PR,
// если закоммиченный dist разошёлся с исходником.
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const AFTER_MERGE = process.argv.includes('--after-merge');

const git = (...args) =>
  spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });

/** Пересобрать мини-апп. Возвращает текст ошибки или null. */
function rebuild() {
  if (!existsSync(join(ROOT, 'schema-miniapp', 'node_modules'))) {
    return 'не установлены зависимости мини-аппа (npm ci --prefix schema-miniapp)';
  }
  const res = spawnSync('npm', ['run', 'build', '--prefix', 'schema-miniapp'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  if (res.status !== 0) {
    return `сборка мини-аппа упала:\n${res.stdout || ''}${res.stderr || ''}`;
  }
  return null;
}

if (!AFTER_MERGE) {
  // ── Режим драйвера ─────────────────────────────────────────────────────────
  // %A уже содержит «нашу» версию, трогать файл не надо: любое его содержимое
  // сейчас всё равно неверно и будет переписано пересборкой. Наша задача —
  // не оставить маркеры конфликта внутри бандла и сказать, что дальше.
  const label = process.argv[3] ?? 'schema-miniapp/dist';
  console.error(
    `merge-miniapp-dist: ${label} не сводится построчно (это сборка).\n` +
      'Конфликт снят, содержимое временно неверное — его перезапишет пересборка ' +
      '(хук post-merge делает это сам).\n' +
      'Если хук не сработал:\n' +
      '  npm run build --prefix schema-miniapp && git add -A schema-miniapp/dist',
  );
  process.exit(0);
}

// ── Режим post-merge ─────────────────────────────────────────────────────────
// Хук зовётся после КАЖДОГО слияния, поэтому сначала дешёвая проверка: трогало
// ли слияние мини-апп вообще. HEAD@{1} — состояние до слияния.
const touched = git('diff', '--name-only', 'HEAD@{1}', 'HEAD');
if (touched.status !== 0) process.exit(0);
if (!touched.stdout.split('\n').some((f) => f.startsWith('schema-miniapp/'))) {
  process.exit(0);
}

const error = rebuild();
if (error) {
  console.error(
    `⚠ мини-апп не пересобран после слияния: ${error}\n` +
      'Закоммиченный dist сейчас не соответствует исходнику — CI-джоба `miniapp` ' +
      'это поймает. Пересобери и допиши в коммит слияния.',
  );
  process.exit(0);
}

if (!git('status', '--porcelain', 'schema-miniapp/dist').stdout.trim()) {
  process.exit(0); // сборка ничего не изменила — сводить нечего
}

git('add', '-A', 'schema-miniapp/dist');
console.error(
  '✓ мини-апп пересобран после слияния, schema-miniapp/dist застейджен.\n' +
    '  Допиши его в коммит слияния: git commit --amend --no-edit',
);
