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
];
