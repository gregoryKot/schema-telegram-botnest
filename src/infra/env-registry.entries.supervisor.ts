// Записи реестра env-переменных (см. env-registry.ts) — то, что приложению
// передаёт супервизор контейнера (deploy/entrypoint.mjs), а не владелец в
// панели площадки. Подключаются в PLATFORM_ENV_ENTRIES. Группа — infra.
import { EnvVarSpec } from './env-registry';

export const SUPERVISOR_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'STARTUP_LAUNCH',
    purpose:
      'Номер запуска приложения внутри контейнера — ставит deploy/entrypoint.mjs, ' +
      'вручную не задаётся. 1 — DM «Деплой завершён», больше 1 — DM о ' +
      'перезапуске после падения (src/telegram/start-announce.ts).',
    requiredInProd: false,
    format: (value: string): string | null =>
      /^[1-9]\d*$/.test(value) ? null : 'ожидалось целое число от 1',
    group: 'infra',
  },
  {
    name: 'STARTUP_CRASHES_DAY',
    purpose:
      'Падений приложения за сутки в этом контейнере — ставит deploy/entrypoint.mjs, ' +
      'вручную не задаётся. Число попадает в DM о перезапуске (src/telegram/start-announce.ts).',
    requiredInProd: false,
    format: (value: string): string | null =>
      /^(0|[1-9]\d*)$/.test(value) ? null : 'ожидалось целое число от 0',
    group: 'infra',
  },
  {
    name: 'STARTUP_NOTICE',
    purpose:
      'Троттл DM о старте, который ведёт супервизор (deploy/crash-window.mjs): «0» — ' +
      'не слать (о таком числе падений за сутки уже сообщали), «1» — слать. Вручную не задаётся.',
    requiredInProd: false,
    format: (value: string): string | null =>
      value === '0' || value === '1' ? null : 'ожидалось 0 или 1',
    group: 'infra',
  },
];
