#!/usr/bin/env node
// Гейт «занял эфемерный порт, отпустил, биндит позже» (#547,
// docs/TEST_IMPROVEMENT_PLAN.md п. 3.4). Спек просит у ядра свободный порт
// (`listen(0)`), закрывает сервер и отдаёт номер наружу — в этом окне порт
// свободен для всей машины, и его берёт любой bind соседнего jest-воркера.
// Три такие копии жили в src/infra/*.spec.ts, их свели в
// src/test-support/ephemeral-port.ts, а две своих `freePort()` остались
// (docker-healthcheck.spec.ts, migrate-stuck-record.e2e-spec.ts). Законное
// место механики одно — ephemeral-port.ts: `reservePort` + поздний бинд через
// `listenWithRetry`, или `listenOn` на 0 без отпускания.
//
// Узкий признак: `.listen(0…)` и `.close(` в ОДНОЙ функции (разбор —
// ephemeral-port-scan.mjs). Сервер, поднятый в beforeAll и закрытый в
// afterAll или в `stop()`, — разные функции, гейт молчит. Бейслайна и
// --update нет: исключение одно, ALLOWED ниже.
//
//   node scripts/check-ephemeral-port.mjs
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { findReleasedPorts } from './ephemeral-port-scan.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DIRS = ['src', 'test', 'e2e-browser', 'scripts', 'deploy'];
const SKIP = new Set(['node_modules', 'dist', 'coverage']);
/** Единственный владелец механики «занять и отпустить» (с поздним бинд-ретраем). */
export const ALLOWED = ['src/test-support/ephemeral-port.ts'];

function walk(dir, acc = []) {
  let names;
  try {
    names = readdirSync(join(ROOT, dir));
  } catch {
    return acc; // песочница без каталога — валидный пустой случай
  }
  for (const name of names) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, acc);
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(name)) acc.push(rel);
  }
  return acc;
}

function main() {
  const bad = [];
  for (const rel of DIRS.flatMap((d) => walk(d))) {
    if (ALLOWED.includes(rel)) continue;
    const lines = findReleasedPorts(readFileSync(join(ROOT, rel), 'utf8'));
    for (const line of lines) bad.push(`${rel}:${line}`);
  }
  if (bad.length === 0) {
    console.log(
      '✓ эфемерный порт: listen(0) и close() в одной функции — только в ephemeral-port.ts',
    );
    return;
  }
  console.error(
    '❌ порт занимают и отпускают, чтобы забиндить позже (гонка с соседним воркером, #547):',
  );
  for (const b of bad) console.error(`   ${b}`);
  console.error(
    'Номер для позднего бинда — reservePort() + listenWithRetry(), слушатель на свободном ' +
      'порту — listenOn(server) без close (src/test-support/ephemeral-port.ts); дочернему ' +
      'процессу — PORT=0 и номер из его лога.',
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
