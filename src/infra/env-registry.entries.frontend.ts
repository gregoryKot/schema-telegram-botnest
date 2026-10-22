// Записи реестра env (см. env-registry.ts): переключатели единой версии
// фронтенда (docs/ONE_FRONTEND_PLAN.md). Своя группа-файл, как у остальных.
import { EnvVarSpec, formats } from './env-registry';

export const FRONTEND_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'UNIFIED_FRONTEND',
    purpose:
      'Единая версия: `/app/*` мини-аппа редиректится в кабинет `/today`, ' +
      '`/app/sw.js` отдаёт заглушку, снимающую старый service worker. ' +
      'Значения `1`/`true` включают, иначе выключено. Включается на этапе 5 ' +
      'плана docs/ONE_FRONTEND_PLAN.md.',
    requiredInProd: false,
    format: formats.oneOf(['1', 'true', '0', 'false']),
    group: 'infra',
  },
];
