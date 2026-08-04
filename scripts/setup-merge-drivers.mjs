#!/usr/bin/env node
// Ставит merge-драйверы репозитория в .git/config.
//
// .gitattributes лежит в репозитории и приезжает с клоном, а САМИ драйверы —
// нет: git принципиально не исполняет команды из клонированного репозитория
// без явного согласия. Поэтому строчка `merge=ratchet-min` без этой установки
// молча деградирует до обычного текстового слияния — то есть защита есть на
// бумаге и нет на деле. Скрипт вызывается из npm `prepare` (то есть на каждом
// `npm install`), запускать руками не нужно; идемпотентен.
//
//   node scripts/setup-merge-drivers.mjs            — поставить
//   node scripts/setup-merge-drivers.mjs --check    — сверка для CI (см. ниже)
//
// --check ничего не ставит: он проверяет, что у каждого `merge=<имя>` из
// .gitattributes есть драйвер в этом файле, а у каждого драйвера — свой
// скрипт. Без сверки легко добавить атрибут и забыть драйвер: слияние тогда
// пойдёт текстовым, ошибки не будет, и узнаем мы об этом по битому бейслайну.
import { spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');

// имя драйвера → человекочитаемое описание + команда (%O %A %B %P подставляет git)
const DRIVERS = {
  'ratchet-min': {
    name: 'JSON-бейслайн храповика: меньше — лучше',
    script: 'scripts/merge-json-ratchet.mjs',
    args: 'min %O %A %B %P',
  },
  'ratchet-max': {
    name: 'JSON-бейслайн храповика: больше — лучше',
    script: 'scripts/merge-json-ratchet.mjs',
    args: 'max %O %A %B %P',
  },
  'miniapp-dist': {
    name: 'schema-miniapp/dist: гасит конфликт, dist пересоберёт post-merge',
    script: 'scripts/merge-miniapp-dist.mjs',
    args: '%A %P',
  },
};

function usedInAttributes() {
  const path = join(ROOT, '.gitattributes');
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  return [...new Set([...text.matchAll(/\bmerge=([\w.-]+)/g)].map((m) => m[1]))];
}

if (CHECK) {
  const problems = [];
  for (const used of usedInAttributes()) {
    if (!DRIVERS[used]) {
      problems.push(
        `.gitattributes ссылается на merge=${used}, но драйвера с таким именем ` +
          'нет в scripts/setup-merge-drivers.mjs — слияние пойдёт текстовым, молча',
      );
    }
  }
  for (const [driver, { script }] of Object.entries(DRIVERS)) {
    if (!existsSync(join(ROOT, script))) {
      problems.push(`драйвер ${driver} ссылается на несуществующий ${script}`);
    }
  }
  if (problems.length) {
    console.error('❌ merge-драйверы рассинхронизированы:');
    for (const p of problems) console.error(`   ${p}`);
    process.exit(1);
  }
  console.log(
    `✅ merge-драйверы: ${Object.keys(DRIVERS).length} объявлено, ` +
      `все имена из .gitattributes покрыты.`,
  );
  process.exit(0);
}

// Установка. Любая проблема — предупреждение, а не падение: `prepare` не имеет
// права ронять `npm install` (в CI и в Docker git-конфига может не быть вовсе).
const gitDir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (gitDir.status !== 0) {
  console.log('merge-драйверы: не git-репозиторий, пропускаю.');
  process.exit(0);
}

let installed = 0;
for (const [driver, { name, script, args }] of Object.entries(DRIVERS)) {
  for (const [key, value] of [
    [`merge.${driver}.name`, name],
    [`merge.${driver}.driver`, `node ${script} ${args}`],
  ]) {
    const res = spawnSync('git', ['config', key, value], { cwd: ROOT });
    if (res.status !== 0) {
      console.warn(
        `merge-драйверы: не удалось записать ${key} — слияние ${driver} ` +
          'пойдёт текстовым. Поставь вручную: node scripts/setup-merge-drivers.mjs',
      );
    }
  }
  installed += 1;
}

// Хук post-merge: драйвер miniapp-dist только гасит конфликт, а верный dist
// можно собрать лишь когда слитый исходник уже лежит в рабочем дереве — то
// есть после слияния. Хук и делает это сам, чтобы шаг не держался на памяти
// агента (подстраховка — CI-джоба `miniapp`).
const HOOK_MARK = 'schema-telegram-botnest: merge-драйверы';
const HOOK_BODY = [
  '#!/bin/sh',
  `# ${HOOK_MARK} (поставлен scripts/setup-merge-drivers.mjs).`,
  '# Пересобирает мини-апп после слияния, если оно его трогало.',
  'exec node scripts/merge-miniapp-dist.mjs --after-merge',
  '',
].join('\n');

const hookPath = join(gitDir.stdout.trim(), 'hooks', 'post-merge');
try {
  // Чужой хук не затираем — он может делать что-то своё.
  if (existsSync(hookPath) && !readFileSync(hookPath, 'utf8').includes(HOOK_MARK)) {
    console.warn(
      `merge-драйверы: в ${hookPath} уже лежит чужой post-merge — не трогаю.\n` +
        '  Добавь в него строку сам:\n' +
        '  node scripts/merge-miniapp-dist.mjs --after-merge',
    );
  } else {
    mkdirSync(dirname(hookPath), { recursive: true });
    writeFileSync(hookPath, HOOK_BODY);
    chmodSync(hookPath, 0o755);
  }
} catch (e) {
  console.warn(
    `merge-драйверы: не удалось поставить post-merge (${e.message}) — ` +
      'после слияния пересобирай мини-апп руками.',
  );
}

console.log(`merge-драйверы: настроено ${installed}, хук post-merge на месте.`);
