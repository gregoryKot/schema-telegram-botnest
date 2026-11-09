#!/usr/bin/env node
// Гейт leader-election для кронов (`@Cron(`, `@nestjs/schedule`).
//
// Крон без leader-election на втором инстансе (второй под, перекатывающийся
// деплой Amvera) выполняется ДВАЖДЫ на том же тике: два процесса шлют одно и
// то же напоминание/пост дважды. Ни один существующий гейт этого не ловит —
// ни `check-alert-throttle.mjs` (троттлинг канала доставки, не дублей
// выполнения), ни `check-silent-catch.mjs`, ни tsc/eslint.
//
// Гейт СПЕЦИАЛЬНО не ищет признак («есть ли рядом claimRun») — поиск по
// признаку молчит о том, чего не знает (тот же изъян, что у
// `USER_DATA_TABLES`/`table-registry.spec.ts`, слепого к новой модели, пока
// её туда не вписали руками). Вместо этого гейт ТРЕБУЕТ явной классификации
// каждого найденного крона в `scripts/cron-leader-baseline.json` — новый крон
// без записи красит CI, а не молча остаётся «наверное безопасным».
//
// Алгоритм (разбор исходника — check-cron-leader-rules.mjs):
//   1. Сканирует src/**/*.ts (без *.spec.ts/*.test.ts/test-support/), ищет
//      декоратор `@Cron(` (многострочный распознаётся балансом скобок) и
//      метод под ним; тело — балансом фигурных скобок.
//   2. Каждый крон обязан быть в бейслайне:
//        { "status": "leader" | "exempt", "reason": "..." }
//      leader без `claimRun(` — красное; `claimRun(` ищется в теле и в методах
//      того же файла, до которых тело доходит через `this.x()`. exempt с
//      причиной короче 20 символов или словом-отпиской — красное.
//   3. Метод, до которого доходят два leader-крона (общий побочный эффект под
//      двумя разными арендами), — красное, если он не записан
//      `{ "status": "shared", "reason": "..." }` (законный общий хелпер).
//      Leader-крон, зовущий тело другого leader-крона, так не освобождается:
//      ключ занят классификацией самого крона.
//   4. Протухшая запись (крона нет, shared-метод больше не общий) — красное:
//      это не уборка, а сигнал «сверься, что произошло».
//
// Флага --update НЕТ и не будет: это классификация решения человека
// («это дублировать нельзя» vs «это идемпотентно/пер-инстансово»), а не
// счётчик долга — переигрывать её автоматически нельзя.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { findCrons, reasonProblem, sharedUnderLeases } from './check-cron-leader-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'cron-leader-baseline.json');

function walk(dir, acc = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'test-support') continue;
      walk(rel, acc);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — scripts/cron-leader-baseline.json обязан существовать\n' +
        '(флага --update нет: классификация вносится руками, см. CLAUDE.md).',
    );
    process.exit(1);
    return {};
  }
}

function cronProblems(found, baseline) {
  const problems = [];
  const missing = [...found.keys()].filter((k) => !(k in baseline));
  if (missing.length) {
    problems.push(
      'незаклассифицированные кроны (нет записи в scripts/cron-leader-baseline.json):',
      ...missing.map((k) => `   ${k}  (L${found.get(k).line})`),
    );
  }
  const stale = Object.keys(baseline).filter((k) => !found.has(k) && baseline[k]?.status !== 'shared');
  if (stale.length) {
    problems.push(
      'протухшие записи бейслайна (крон в коде не найден — сверься, что произошло):',
      ...stale.map((k) => `   ${k}`),
    );
  }
  for (const [key, c] of found) {
    const entry = baseline[key];
    if (!entry) continue;
    if (entry.status === 'leader') {
      if (!c.hasClaimRun) problems.push(`${key}: объявлен leader, но claimRun( в теле метода не найдено`);
    } else if (entry.status === 'exempt') {
      const p = reasonProblem(key, entry.reason, 'exempt');
      if (p) problems.push(p);
    } else {
      problems.push(`${key}: неизвестный status «${entry.status}» (допустимо leader|exempt)`);
    }
  }
  return problems;
}

function sharedProblems(crons, baseline) {
  const problems = [];
  const shared = sharedUnderLeases(crons, baseline);
  for (const [key, owners] of shared) {
    const entry = baseline[key];
    if (entry?.status === 'shared') {
      const p = reasonProblem(key, entry.reason, 'shared');
      if (p) problems.push(p);
    } else {
      problems.push(`${key}: метод под арендами двух leader-кронов (${owners.join(', ')}) — побочный эффект идёт дважды`);
    }
  }
  for (const [key, entry] of Object.entries(baseline)) {
    if (entry?.status === 'shared' && !shared.has(key)) {
      problems.push(`${key}: shared-запись протухла — до метода больше не доходят два leader-крона`);
    }
  }
  return problems;
}

function main() {
  const crons = [];
  for (const rel of walk('src')) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (raw.includes('@Cron(')) crons.push(...findCrons(rel, raw));
  }
  const found = new Map(crons.map((c) => [c.key, c]));
  const baseline = loadBaseline();
  const problems = [...cronProblems(found, baseline), ...sharedProblems(crons, baseline)];

  if (problems.length) {
    console.error('❌ Гейт leader-election для кронов (CLAUDE.md):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nКрон без leader-election дублируется на втором инстансе (второй под,\n' +
        'перекатывающийся деплой) — два процесса шлют одно и то же сообщение\n' +
        'дважды. Для каждого крона впиши в scripts/cron-leader-baseline.json:\n' +
        '  "<файл>::<метод>": { "status": "leader", "reason": "..." }\n' +
        'и добавь claimRun( в тело метода, ЛИБО, если дублирование безопасно\n' +
        '(идемпотентно, пер-инстансово, сериализовано иначе):\n' +
        '  "<файл>::<метод>": { "status": "exempt", "reason": "честная причина, не отписка" }\n' +
        'Метод под двумя арендами: один вход (одна аренда) либо, если повтор законен,\n' +
        '  "<файл>::<метод>": { "status": "shared", "reason": "почему двойной вызов безопасен" }\n' +
        'Флага --update нет — это классификация решения человека, не счётчик.',
    );
    process.exit(1);
  }

  const sharedCount = Object.values(baseline).filter((e) => e?.status === 'shared').length;
  console.log(
    `✓ гейт leader-election кронов: ${found.size} кронов, все классифицированы; общих методов под арендами — ${sharedCount}, все с причиной.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
