// Кросс-проверки env для бэкапов БД в R2 (аудит D-2): подключаются в
// CROSS_CHECKS (env-check.ts). Отдельный файл — env-check.ts под храповиком
// размера (правило №10).
import type { CrossCheck } from './env-check';
import { BACKUP_REQUIRED_ENV_VARS, missingBackupVars } from './backup-config';

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
  {
    id: 'backupKeyDistinctFromEncryptionKey',
    check: (env) => {
      const key = env.BACKUP_ENCRYPTION_KEY?.trim();
      return key && key === env.ENCRYPTION_KEY?.trim()
        ? 'BACKUP_ENCRYPTION_KEY совпадает с ENCRYPTION_KEY — ключи бэкапов и полей БД должны различаться'
        : null;
    },
  },
];
