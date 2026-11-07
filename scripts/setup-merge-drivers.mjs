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
// .gitattributes есть драйвер в этом файле, у каждого драйвера — свой скрипт
// и у каждого `*-baseline.json` — явная строка в .gitattributes (логика —
// scripts/merge-drivers-check.mjs). Без сверки легко добавить атрибут и
// забыть драйвер или завести бейслайн и забыть атрибут: слияние тогда пойдёт
// текстовым, ошибки не будет, и узнаем мы об этом по битому бейслайну.
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { checkMergeDrivers } from './merge-drivers-check.mjs';

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
  'ratchet-sum': {
    name: 'JSON-бейслайн храповика: счётчик, рост двух сторон складывается',
    script: 'scripts/merge-json-ratchet.mjs',
    args: 'sum %O %A %B %P',
  },
};

if (CHECK) {
  const { problems, baselines } = checkMergeDrivers(ROOT, DRIVERS);
  if (problems.length) {
    console.error('❌ merge-драйверы рассинхронизированы:');
    for (const p of problems) console.error(`   ${p}`);
    process.exit(1);
  }
  console.log(
    `✅ merge-драйверы: ${Object.keys(DRIVERS).length} объявлено, ` +
      `все имена из .gitattributes покрыты, у ${baselines} бейслайнов есть атрибут.`,
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

// Хук post-merge ставил сборку мини-аппа после слияния; мини-аппа больше нет.
// Хук, поставленный прежней версией скрипта (по метке), убираем — иначе он
// будет звать удалённый scripts/merge-miniapp-dist.mjs после каждого слияния.
const HOOK_MARK = 'schema-telegram-botnest: merge-драйверы';
const hookPath = join(gitDir.stdout.trim(), 'hooks', 'post-merge');
try {
  if (existsSync(hookPath) && readFileSync(hookPath, 'utf8').includes(HOOK_MARK)) {
    rmSync(hookPath);
  }
} catch (e) {
  console.warn(`merge-драйверы: не удалось убрать старый post-merge (${e.message}).`);
}

console.log(`merge-драйверы: настроено ${installed}.`);
