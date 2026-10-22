// Кросс-проверки env для бэкапов БД в R2 (аудит D-2): подключаются в
// CROSS_CHECKS (env-check.ts). Отдельный файл — env-check.ts под храповиком
// размера (правило №10).
import type { CrossCheck } from './env-check';
import { BACKUP_REQUIRED_ENV_VARS, missingBackupVars } from './backup-config';
import { BACKUP_EXTRA_CROSS_CHECKS } from './env-check.backup-extra';

export const BACKUP_CROSS_CHECKS: CrossCheck[] = [
  {
    // Бэкапы включаются только полным набором: без любой переменной
    // планировщик молча не стартует, а владелец думает, что копии есть.
    id: 'backupBucketRequiresBackupSetup',
    check: (env) => {
      if (!env.BACKUP_S3_BUCKET?.trim()) return null;
      const missing = missingBackupVars(env).filter(
        (k) => k !== 'BACKUP_S3_BUCKET',
      );
      return missing.length === 0
        ? null
        : `BACKUP_S3_BUCKET задан, но не задан(ы) ${missing.join(', ')} ` +
            `(нужны все: ${BACKUP_REQUIRED_ENV_VARS.join(', ')})`;
    },
  },
  ...BACKUP_EXTRA_CROSS_CHECKS,
];
