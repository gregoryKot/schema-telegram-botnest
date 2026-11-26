'use strict';
// Остановка идущего бэкапа (SIGTERM деплоя) — вынесено из backup-scheduler.cjs
// (храповик размера, правило №10).
//
// Прогон держит аренду CronLease 'db-backup' на 20 ч. Раньше stop() только
// гасил скрипт, а релиз аренды шёл асинхронно в ветке failed runTick — и
// гонялся с process.exit в entrypoint.finish(): бэкап, оборванный деплоем,
// следующий раз шёл только после окна аренды. Здесь релиз синхронный
// (spawnSync), с коротким таймаутом: остановку процесса он не держит дольше.

const { spawnSync: nodeSpawnSync } = require('node:child_process');
const { pgEnvFromUrl } = require('./pg-url-env.cjs');

const STOP_RELEASE_TIMEOUT_MS = 5_000;

/**
 * Гасит скрипт бэкапа и синхронно отпускает СВОЮ аренду (`sql` — RELEASE_SQL
 * планировщика). Не бросает: что бы ни случилось, процесс должен выйти.
 */
function stopRun(ctx, sql, lease) {
  const { state, env, log, instanceId } = ctx;
  state.child.kill('SIGTERM');
  const spawnSync = ctx.spawnSync ?? nodeSpawnSync;
  let res;
  try {
    const vars = ['-v', `lease=${lease}`, '-v', `inst=${instanceId}`];
    res = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...vars, '-f', '-'], {
      env: { ...env, ...pgEnvFromUrl(env.DATABASE_URL) },
      input: sql,
      timeout: STOP_RELEASE_TIMEOUT_MS,
      encoding: 'utf8',
    });
  } catch (error) {
    res = { status: -1, error };
  }
  if (res.status === 0) {
    log.info('[backup] прогон прерван остановкой процесса, аренда отпущена');
    return true;
  }
  const why = res.error?.message || String(res.stderr ?? '').trim() || `код ${res.status}`;
  log.error(`[backup] FAILED аренда при остановке не отпущена: ${why.slice(0, 200)}`);
  return false;
}

module.exports = { stopRun, STOP_RELEASE_TIMEOUT_MS };
