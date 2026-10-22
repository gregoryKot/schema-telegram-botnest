// Что супервизор контейнера (deploy/entrypoint.mjs → crash-window.mjs) передаёт
// приложению о запуске. Модуль без зависимостей: его имена читает и спек
// настоящего entrypoint (maintenance-startup.spec.ts), которому граф Nest и
// telegraf ни к чему. Обе стороны шва держатся одних строк.
export const STARTUP_ENV = {
  /** Номер запуска приложения с начала работы контейнера, от 1. */
  launch: 'STARTUP_LAUNCH',
  /** Падений приложения за последние сутки в этом контейнере. */
  crashes: 'STARTUP_CRASHES_DAY',
  /** «0» — супервизор решил не слать DM о старте (троттл), иначе слать. */
  notice: 'STARTUP_NOTICE',
} as const;

export interface StartupEnv {
  launch?: string;
  crashes?: string;
  notice?: string;
}

/** Значения из env процесса; без супервизора (локальный запуск) — пусто. */
export function readStartupEnv(): StartupEnv {
  return {
    launch: process.env.STARTUP_LAUNCH,
    crashes: process.env.STARTUP_CRASHES_DAY,
    notice: process.env.STARTUP_NOTICE,
  };
}
