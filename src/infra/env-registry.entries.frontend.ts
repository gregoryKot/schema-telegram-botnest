// Записи реестра env (см. env-registry.ts): переключатели единой версии
// фронтенда (docs/ONE_FRONTEND_PLAN.md). Своя группа-файл, как у остальных.
import { EnvVarSpec, formats } from './env-registry';

export const FRONTEND_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'UNIFIED_FRONTEND',
    purpose:
      'Единая версия: `/app/*` мини-аппа редиректится в кабинет `/today`, ' +
      '`/app/sw.js` отдаёт заглушку, снимающую старый service worker. ' +
      'Включено по умолчанию (этап 5 плана docs/ONE_FRONTEND_PLAN.md); ' +
      '`0`/`false` — откат, `/app/` снова отдаёт мини-апп.',
    requiredInProd: false,
    format: formats.oneOf(['1', 'true', '0', 'false']),
    group: 'infra',
  },
];
