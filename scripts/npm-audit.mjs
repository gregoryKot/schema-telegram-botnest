#!/usr/bin/env node
// npm audit одного lock-файла с повторами при недоступном реестре (регресс
// #814, 2026-10-22). Голый `npm audit` в CI висел на запросе к реестру до
// таймаута шага, а при сбое bulk-эндпоинта npm откатывается на выведенный
// `/-/npm/v1/security/audits/quick`, который отвечает 400 «This endpoint is
// being retired». Красный main без единой уязвимости — ложно-красный гейт,
// такой отключают (правило №15 п.4). Поэтому исход решает отчёт, а не код
// выхода npm:
//   отчёт есть, high/critical есть  → 1 сразу, без повторов (повтор не
//                                      «отмывает» найденное);
//   отчёт есть, high/critical нет   → 0 (moderate/low не гейтим, как и
//                                      `--audit-level=high`);
//   отчёта нет ни с одной попытки   → 2 и ::error:: «реестр не ответил» —
//                                      непроверенное зелёным не бывает.
// «Отчёт есть» = JSON без `error` с числовыми metadata.vulnerabilities
// (формат npm 10: @npmcli/arborist audit-report.js toJSON; ошибка реестра в
// --json — lib/utils/audit-error.js, поля message/statusCode/body/error).
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

const GATING = ['high', 'critical'];
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
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    killGroup();
    process.exit(1);
  });
}

/** Одна попытка: stdout npm и признак «убит по таймеру». */
function runOnce(dir) {
  const args = ['audit', '--omit=dev', '--audit-level=high', '--json',
    `--fetch-timeout=${FETCH_TIMEOUT_MS}`, '--prefix', dir];
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
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
      // Внук, ушедший из группы, держал бы pipe — не ждём его.
      grace = setTimeout(() => finish(), 2_000);
    }, ATTEMPT_MS);
  });
}

/** Разбор stdout: clean | vulnerable | none (отчёта нет, с причиной). */
function classify(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'none', reason: text.trim() ? 'ответ npm — не JSON' : 'npm ничего не вывел' };
  }
  if (data?.error || data?.statusCode) {
    const body = data.body?.message ? ` (${data.body.message})` : '';
    return { kind: 'none', reason: `реестр ответил ошибкой: ${data.message ?? 'без текста'}${body}` };
  }
  const counts = data?.metadata?.vulnerabilities;
  if (!counts || !GATING.every((s) => Number.isInteger(counts[s]))) {
    return { kind: 'none', reason: 'в ответе нет metadata.vulnerabilities' };
  }
  if (!GATING.some((s) => counts[s] > 0)) return { kind: 'clean', counts };
  const packages = Object.values(data.vulnerabilities ?? {})
    .filter((v) => GATING.includes(v?.severity));
  return { kind: 'vulnerable', counts, packages };
}

/** «lodash — high, затронуто <=4.17.23» + заголовки advisory уровня high+. */
function describe(v) {
  const fix = v.fixAvailable?.version ? `; исправлено в ${v.fixAvailable.version}` : '';
  const lines = [`  ${v.name} — ${v.severity}, затронуто ${v.range}${fix}`];
  for (const via of v.via ?? []) {
    if (typeof via === 'string') lines.push(`    · через ${via}`);
    else if (GATING.includes(via.severity)) lines.push(`    · ${via.title} (${via.url})`);
  }
  return lines.join('\n');
}

async function main() {
  const dir = process.argv[2] || '.';
  for (let i = 1; i <= ATTEMPTS; i++) {
    const r = await runOnce(dir);
    const v = r.timedOut
      ? { kind: 'none', reason: `нет ответа за ${ATTEMPT_MS / 1000} с, процесс npm убит` }
      : r.spawnError ? { kind: 'none', reason: `npm не запустился: ${r.spawnError}` }
      : classify(r.out);
    if (v.kind === 'vulnerable') {
      const { high, critical } = v.counts;
      console.log(`::error::npm audit ${dir}: в prod-зависимостях high — ${high}, critical — ${critical}`);
      console.log(v.packages.map(describe).join('\n'));
      return 1;
    }
    if (v.kind === 'clean') {
      const { moderate, low } = v.counts;
      console.log(`npm audit ${dir}: high/critical в prod-зависимостях нет (moderate — ${moderate}, low — ${low})`);
      return 0;
    }
    console.log(`::warning::npm audit ${dir}: попытка ${i}/${ATTEMPTS} без отчёта — ${v.reason}`);
    if (i < ATTEMPTS) await new Promise((ok) => setTimeout(ok, PAUSE_MS));
  }
  console.log(`::error::npm audit ${dir}: реестр npm не ответил (попыток: ${ATTEMPTS}) — это не уязвимость; перезапусти джобу`);
  return 2;
}

process.exitCode = await main();
