#!/usr/bin/env node
// npm audit одного lock-файла с повторами при недоступном реестре (регресс
// #814, 2026-10-22). Голый `npm audit` в CI висел на запросе к реестру до
// таймаута шага, а при сбое bulk-эндпоинта npm откатывается на выведенный
// `/-/npm/v1/security/audits/quick`, который отвечает 400 «This endpoint is
// being retired». Красный main без единой уязвимости — ложно-красный гейт,
// такой отключают (правило №15 п.4). Поэтому исход решает отчёт, а не код
// выхода npm:
//   отчёт есть, high/critical есть  → 4 сразу, без повторов (повтор не
//                                      «отмывает» найденное); не 1: единицу
//                                      node отдаёт сам на необработанном
//                                      исключении, и упавшая обёртка
//                                      читалась бы как «уязвимость»;
//   отчёт есть, high/critical нет   → 0 (moderate/low не гейтим, как и
//                                      `--audit-level=high`);
//   отчёта нет ни с одной попытки   → 2 и ::error:: «реестр не ответил» —
//                                      непроверенное зелёным не бывает;
//   npm не может проверить каталог  → 3 сразу, без повторов (нет lock-файла,
//                                      npm не запустился): перезапуск джобы
//                                      тут не поможет, нужна починка;
//   SIGTERM/SIGINT (таймаут шага)   → 143/130: «убит» ≠ «уязвимость».
// Разбор ответа npm (формы, коды) — npm-audit-report.mjs.
//
// Реестр и онлайн-режим задаются флагами, а не наследуются из env/.npmrc:
// при `npm_config_offline=true` npm отдаёт нулевые счётчики без запроса —
// неотличимо от чистого отчёта, а чужой `npm_config_registry` отвечает чем
// угодно. Флаг командной строки сильнее env и .npmrc (проверено живым npm
// 10.9.4 на lock-файле с critical minimist: без флагов — 0 находок, с ними —
// critical 1). Arborist берёт адрес как `auditRegistry || registry`, но
// `npm_config_audit_registry` в env npm 10.9.4 в конфиг не пропускает (POST
// всё равно ушёл на registry.npmjs.org — проверено при ревью #814), поэтому
// отдельного флага для него нет.
//
// Почему внешний таймер, а не только флаги npm: `--fetch-retries` к audit не
// применяется (make-fetch-happen lib/remote.js не повторяет POST), а
// `--fetch-timeout` (по умолчанию 5 минут) ограничивает каждый запрос, но не
// весь прогон: bulk + откат на quick — уже два. `--fetch-timeout` ставим,
// чтобы попытка заканчивалась ответом с причиной, а не убийством; таймер
// убивает группу процессов целиком (npm и его детей).
//
// Флаги и уровень пинит исполнением src/test-support/gates/npm-audit.spec.ts
// (поддельный npm на PATH, записанные ответы реестра); гейт «шаг на каждый
// lock-файл» узнаёт вызов обёртки — lockfile-audit.ts.
//
//   node scripts/npm-audit.mjs [каталог с package-lock.json]
// Без каталога — текущий, как у самого `npm audit` без --prefix.
// Для тестов: NPM_AUDIT_ATTEMPTS, NPM_AUDIT_ATTEMPT_MS, NPM_AUDIT_PAUSE_MS.
import { spawn } from 'child_process';
import { classify, describe } from './npm-audit-report.mjs';

const REGISTRY = 'https://registry.npmjs.org/';
const FETCH_TIMEOUT_MS = 15_000;
const knob = (name, dflt) => {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : dflt;
};
const ATTEMPTS = knob('NPM_AUDIT_ATTEMPTS', 3);
const ATTEMPT_MS = knob('NPM_AUDIT_ATTEMPT_MS', 45_000);
const PAUSE_MS = knob('NPM_AUDIT_PAUSE_MS', 10_000);

let child = null;
const killGroup = () => {
  try {
    if (child?.pid) process.kill(-child.pid, 'SIGKILL');
  } catch {
    // группа уже завершилась — убивать нечего
  }
};
// Свой код у убийства снаружи: «убит» — не «найдена уязвимость».
for (const [sig, code] of [['SIGTERM', 143], ['SIGINT', 130]]) {
  process.on(sig, () => {
    killGroup();
    process.exit(code);
  });
}

/** Одна попытка: stdout npm и признак «убит по таймеру». */
function runOnce(dir) {
  const args = ['audit', '--omit=dev', '--audit-level=high', '--json',
    `--fetch-timeout=${FETCH_TIMEOUT_MS}`, '--offline=false',
    `--registry=${REGISTRY}`, '--prefix', dir];
  return new Promise((done) => {
    let out = '';
    let timedOut = false;
    let settled = false;
    const finish = (spawnError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      child = null;
      done({ out, timedOut, spawnError });
    };
    // detached: своя группа процессов, чтобы убить и детей npm.
    child = spawn('npm', args, { detached: true, stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', (b) => { out += b; });
    child.on('error', (e) => finish(e.message));
    child.on('close', () => finish());
    let grace;
    const stdout = child.stdout;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
      // Внук, ушедший из группы (setsid), держал бы pipe и с ним — сам
      // процесс обёртки: закрываем свой конец и не ждём его.
      grace = setTimeout(() => {
        stdout.destroy();
        finish();
      }, 2_000);
    }, ATTEMPT_MS);
  });
}

async function main() {
  const dir = process.argv[2] || '.';
  for (let i = 1; i <= ATTEMPTS; i++) {
    const r = await runOnce(dir);
    const v = r.timedOut
      ? { kind: 'none', reason: `нет ответа за ${ATTEMPT_MS / 1000} с, процесс npm убит` }
      : r.spawnError ? { kind: 'broken', reason: `npm не запустился: ${r.spawnError}` }
      : classify(r.out);
    if (v.kind === 'vulnerable') {
      const { high, critical } = v.counts;
      console.log(`::error::npm audit ${dir}: в prod-зависимостях high — ${high}, critical — ${critical}`);
      console.log(v.packages.map(describe).join('\n'));
      return 4;
    }
    if (v.kind === 'clean') {
      const { moderate, low } = v.counts;
      console.log(`npm audit ${dir}: high/critical в prod-зависимостях нет (moderate — ${moderate}, low — ${low})`);
      return 0;
    }
    if (v.kind === 'broken') {
      console.log(`::error::npm audit ${dir}: npm не может проверить каталог — ${v.reason}; это не уязвимость и не сбой реестра, перезапуск не поможет`);
      return 3;
    }
    console.log(`::warning::npm audit ${dir}: попытка ${i}/${ATTEMPTS} без отчёта — ${v.reason}`);
    if (i < ATTEMPTS) await new Promise((ok) => setTimeout(ok, PAUSE_MS));
  }
  console.log(`::error::npm audit ${dir}: реестр npm не ответил (попыток: ${ATTEMPTS}) — это не уязвимость; перезапусти джобу`);
  return 2;
}

process.exitCode = await main();
