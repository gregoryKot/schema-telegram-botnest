// Тело /health сверх «процесс жив и БД отвечает» (src/api/health.controller.ts).
// Поля аддитивны: смок прода читает их jq по имени (prod-smoke.yml), HEALTHCHECK
// образа ищет подстроку `"status":"ok"` (Dockerfile) — новое поле их не задевает.
//
// - builtAt — время сборки образа (src/utils/build-info.ts). Инцидент
//   2026-09-16: два мержа сутки не были собраны хостингом, а /health отвечал
//   «ок» — проверяли «жив», не «свеж». Смок сверяет метку с последним коммитом
//   main (scripts/check-deploy-lag.mjs). Метки нет → null, а не 503.
// - selfCheck — правило №21: наружу только id упавших проб (детали — в DM и
//   /stats) и stale (часовой крон самопроверки остановился; status при этом ok —
//   HEALTHCHECK не должен откатывать здоровый релиз).
// - startedAt, launch, crashesDay — аудит 2026-10 («Красный смок не говорит,
//   что лежит»): без них рестарт приложения внутри живого контейнера снаружи не
//   виден. launch — номер запуска приложения в этом контейнере (1 — первый после
//   деплоя, больше — перезапуск после падения), crashesDay — падений за сутки;
//   оба считает супервизор (deploy/crash-window.mjs) и передаёт через env
//   (src/telegram/start-launch-env.ts). Без супервизора (локальный запуск) — null.
import { builtAt } from '../utils/build-info';
import { selfCheckState } from '../infra/self-check/state';
import { isSnapshotStale } from '../infra/self-check/freshness';
import { readStartupEnv } from '../telegram/start-launch-env';

export interface HealthReport {
  status: 'ok';
  db: 'up';
  builtAt: string | null;
  selfCheck: { ranAt: string | null; stale: boolean; failed: string[] };
  startedAt: string;
  launch: number | null;
  crashesDay: number | null;
}

/** Момент старта процесса: фиксируется один раз при загрузке модуля. */
export const PROCESS_STARTED_AT_MS =
  Date.now() - Math.round(process.uptime() * 1000);

/** Неотрицательное целое из env супервизора, иначе null. */
function count(raw: string | undefined): number | null {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
}

/** Всё тело /health, кроме status и db (их ставит контроллер после SELECT 1). */
export function healthDetails(): Omit<HealthReport, 'status' | 'db'> {
  const snap = selfCheckState.get();
  const startup = readStartupEnv();
  return {
    builtAt: builtAt()?.toISOString() ?? null,
    selfCheck: {
      ranAt: snap.ranAt === null ? null : new Date(snap.ranAt).toISOString(),
      stale: isSnapshotStale(snap, Date.now(), process.uptime() * 1000),
      failed: snap.results
        .filter((r) => !r.ok && r.reportInHealth)
        .map((r) => r.id),
    },
    startedAt: new Date(PROCESS_STARTED_AT_MS).toISOString(),
    launch: count(startup.launch),
    crashesDay: count(startup.crashes),
  };
}
