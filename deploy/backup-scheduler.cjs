'use strict';
// Планировщик зашифрованных бэкапов БД в Backblaze B2 (аудит D-2: скрипт
// scripts/backup-to-b2.sh годами лежал без вызывающего — бэкапов не было).
//
// Живёт здесь, а не в src/: код в src/** не имеет права на child_process
// (src/security/injection.invariants.spec.ts), а entrypoint — супервизор
// процессов — имеет. CommonJS, потому что так модуль можно импортировать из
// jest-спека (ESM jest не грузит) и из ESM-entrypoint одновременно.
//
// Что делает: раз в час спрашивает «пора ли?» — UTC-час ≥ 3 и сегодня ещё
// не отработано. Прогон забирается арендой строки CronLease 'backup-b2' (тот
// же атомарный INSERT … ON CONFLICT DO UPDATE … WHERE "runAt" <= окно, что в
// src/infra/cron-leader.service.ts, правило №17): на двух инстансах бэкап
// делает один. SQL идёт через psql — своего драйвера у супервизора нет, а
// пересобирать его ради одного запроса незачем. Значения в SQL подставляет
// сам psql (`:'var'` — безопасное квотирование литерала), строкой SQL они не
// склеиваются.
//
// Не настроено (нет B2_*/BACKUP_ENCRYPTION_KEY) — одна строка в лог при
// старте и больше ничего. Результат прогона — строка `[backup] ok <файл>` или
// `[backup] FAILED <причина>`; ключей и паролей в логе нет по построению
// (скрипт их не печатает, сюда попадает только хвост его stderr).
//
// Наблюдатель за результатом — проба самопроверки backupFreshness
// (src/infra/self-check/probe-backup-freshness.ts): «последний бэкап в
// бакете моложе 36 ч». Список REQUIRED_ENV сверяется с ней тестом
// src/infra/backup-scheduler.spec.ts (правило №4).

const { spawn: nodeSpawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { join } = require('node:path');
const { pgEnvFromUrl } = require('./pg-url-env.cjs');

const REQUIRED_ENV = [
  'B2_KEY_ID',
  'B2_APP_KEY',
  'B2_BUCKET',
  'BACKUP_ENCRYPTION_KEY',
  'DATABASE_URL',
];
const LEASE_NAME = 'backup-b2';
const HOUR_MS = 3_600_000;
/** Меньше периода (сутки): иначе законный завтрашний прогон был бы отказан. */
const LEASE_WINDOW_MS = 20 * HOUR_MS;
const START_HOUR_UTC = 3;
const FIRST_TICK_MS = 60_000;
const MAX_FAILS_PER_DAY = 3;
const BACKUP_TIMEOUT_MS = 40 * 60_000;
const SCRIPT = join(__dirname, '..', 'scripts', 'backup-to-b2.sh');

const missingEnv = (env) => REQUIRED_ENV.filter((k) => !(env[k] ?? '').trim());

/** 'YYYY-MM-DD HH:MM:SS.mmm' — литерал для timestamp (без зоны, UTC, как пишет Prisma). */
const sqlTimestamp = (date) => date.toISOString().replace('T', ' ').replace('Z', '');

const CLAIM_SQL = `
INSERT INTO "CronLease" ("name", "runAt", "instanceId")
VALUES (:'lease', :'now'::timestamp, :'inst')
ON CONFLICT ("name") DO UPDATE
  SET "runAt" = :'now'::timestamp, "instanceId" = :'inst'
  WHERE "CronLease"."runAt" <= :'not_after'::timestamp
RETURNING "name";
`;
// Освобождаем только СВОЮ аренду: после сбоя следующий часовой тик может
// повторить попытку, а чужой удачный прогон не затираем.
const RELEASE_SQL = `
UPDATE "CronLease" SET "runAt" = 'epoch'::timestamp
WHERE "name" = :'lease' AND "instanceId" = :'inst';
`;

/** Запускает команду, собирает вывод; не бросает — ошибка запуска это поле `error`. */
function runCommand(spawn, cmd, args, { env, input, timeoutMs, onChild }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      resolve({ stdout, stderr, ...r });
    };
    let child;
    try {
      child = spawn(cmd, args, {
        env,
        timeout: timeoutMs,
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      return done({ code: -1, error });
    }
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (error) => done({ code: -1, error }));
    child.on('close', (code, signal) => done({ code: code ?? -1, signal }));
    if (input !== undefined) child.stdin.end(input);
    onChild?.(child);
  });
}

/** psql(sql, vars) → {code, stdout, stderr, error?}. Соединение — через PG*-переменные. */
function makePsql({ spawn, env }) {
  return (sql, vars) => {
    const args = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'];
    for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
    args.push('-f', '-');
    let pgEnv;
    try {
      pgEnv = pgEnvFromUrl(env.DATABASE_URL);
    } catch (error) {
      return Promise.resolve({ code: -1, stdout: '', stderr: '', error });
    }
    return runCommand(spawn, 'psql', args, {
      env: { ...env, ...pgEnv },
      input: sql,
      timeoutMs: 30_000,
    });
  };
}

/** Последние две непустые строки (последняя — часто общая «команда упала», причина строкой выше). */
const tail = (text) =>
  text.trim().split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 400);

/**
 * Один тик планировщика. Возвращает статус строкой (для тестов и логов):
 * early | done | gave-up | busy | no-psql | db-error | not-leader | ok | failed.
 */
async function runTick(ctx) {
  const { env, now, spawn, psql, log, state, instanceId, script } = ctx;
  const at = now();
  const day = at.toISOString().slice(0, 10);
  if (at.getUTCHours() < START_HOUR_UTC) return 'early';
  if (state.doneDay === day) return 'done';
  if (state.failDay === day && state.fails >= MAX_FAILS_PER_DAY) return 'gave-up';
  if (state.running) return 'busy';

  state.running = true;
  try {
    const vars = {
      lease: LEASE_NAME,
      inst: instanceId,
      now: sqlTimestamp(at),
      not_after: sqlTimestamp(new Date(at.getTime() - LEASE_WINDOW_MS)),
    };
    const claim = await psql(CLAIM_SQL, vars);
    if (claim.error?.code === 'ENOENT') {
      if (!state.warnedNoPsql) {
        state.warnedNoPsql = true;
        log.error('[backup] psql не найден в образе — бэкапы не запускаются (deploy/install-pg-client.sh)');
      }
      return 'no-psql';
    }
    if (claim.code !== 0) {
      log.error(`[backup] FAILED не удалось забрать аренду: ${tail(claim.stderr) || claim.error?.message || 'psql завершился с ошибкой'}`);
      return 'db-error';
    }
    if (claim.stdout.trim() !== LEASE_NAME) {
      // Прогон за последние 20 ч уже забрал другой инстанс (или мы же до рестарта).
      state.doneDay = day;
      log.info('[backup] бэкап за сегодня уже сделан другим инстансом — пропускаю');
      return 'not-leader';
    }

    const res = await runCommand(spawn, 'bash', [script], {
      env,
      timeoutMs: BACKUP_TIMEOUT_MS,
      onChild: (child) => (state.child = child), // stop() прервёт прогон при SIGTERM
    });
    state.child = null;
    const okLine = res.stdout.split('\n').find((l) => l.startsWith('[backup] ok '));
    if (res.code === 0 && okLine) {
      state.doneDay = day;
      log.info(okLine.trim());
      return 'ok';
    }
    const reason =
      tail(res.stderr).replaceAll('[backup] FAILED ', '') ||
      res.error?.message ||
      `код выхода ${res.code}`;
    if (state.failDay === day) state.fails += 1;
    else Object.assign(state, { failDay: day, fails: 1 });
    log.error(`[backup] FAILED ${reason} (попытка ${state.fails}/${MAX_FAILS_PER_DAY})`);
    await psql(RELEASE_SQL, { lease: LEASE_NAME, inst: instanceId });
    return 'failed';
  } finally {
    state.running = false;
  }
}

/**
 * Запускает планировщик. Не настроено → одна строка в лог и null.
 * Всё внешнее (spawn, время, psql, лог) подменяется — так тест идёт без
 * процессов и без часов.
 */
function startBackupScheduler(opts = {}) {
  const env = opts.env ?? process.env;
  const log = opts.log ?? { info: console.log, error: console.error };
  const missing = missingEnv(env);
  if (missing.length > 0) {
    log.info(`[backup] бэкапы в B2 выключены: нет ${missing.join(', ')}`);
    return null;
  }
  const spawn = opts.spawn ?? nodeSpawn;
  const ctx = {
    env,
    spawn,
    log,
    now: opts.now ?? (() => new Date()),
    psql: opts.psql ?? makePsql({ spawn, env }),
    instanceId: env.HOSTNAME?.trim() || `pid-${process.pid}-${randomBytes(3).toString('hex')}`,
    script: opts.script ?? SCRIPT,
    state: { doneDay: null, failDay: null, fails: 0, running: false, warnedNoPsql: false, child: null },
  };
  const tick = () => runTick(ctx).catch((e) => log.error(`[backup] FAILED тик планировщика упал: ${String(e?.message).slice(0, 200)}`));
  const first = setTimeout(tick, opts.firstTickMs ?? FIRST_TICK_MS);
  const timer = setInterval(tick, opts.tickMs ?? HOUR_MS);
  first.unref?.();
  timer.unref?.();
  log.info('[backup] бэкапы в B2 включены: проверка раз в час, прогон после 03:00 UTC');
  return {
    tick,
    stop() {
      clearTimeout(first);
      clearInterval(timer);
      ctx.state.child?.kill('SIGTERM');
    },
  };
}

module.exports = {
  REQUIRED_ENV,
  LEASE_NAME,
  LEASE_WINDOW_MS,
  missingEnv,
  makePsql,
  runTick,
  startBackupScheduler,
};
