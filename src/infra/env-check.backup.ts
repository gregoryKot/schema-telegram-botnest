// Кросс-проверки env для бэкапов БД в B2 (аудит D-2): подключаются в
// CROSS_CHECKS (env-check.ts). Отдельный файл — env-check.ts под храповиком
// размера (правило №10).
import type { CrossCheck } from './env-check';
import { BACKUP_REQUIRED_ENV_VARS, missingBackupVars } from './backup-config';
import { BACKUP_EXTRA_CROSS_CHECKS } from './env-check.backup-extra';

export const BACKUP_CROSS_CHECKS: CrossCheck[] = [
  {
    // Бэкапы включаются только полным набором: без любой переменной
    // планировщик молча не стартует, а владелец думает, что копии есть.
    id: 'b2BucketRequiresBackupSetup',
    check: (env) => {
      if (!env.B2_BUCKET?.trim()) return null;
      const missing = missingBackupVars(env).filter((k) => k !== 'B2_BUCKET');
      return missing.length === 0
        ? null
        : `B2_BUCKET задан, но не задан(ы) ${missing.join(', ')} ` +
            `(нужны все: ${BACKUP_REQUIRED_ENV_VARS.join(', ')})`;
    },
  },
  ...BACKUP_EXTRA_CROSS_CHECKS,
];
