// Запись реестра возможностей «бэкапы в B2» (capability-report.ts, правило
// №21: выключенная по конфигурации возможность — не авария, но молчать о ней
// нельзя: без бэкапов в B2 единственная копия данных — CNPG Amvera).
import type { CapabilityStatus } from './capability-report';
import {
  BACKUP_OPTIONAL_ENV_VARS,
  BACKUP_REQUIRED_ENV_VARS,
  missingBackupVars,
} from './backup-config';

type Env = Record<string, string | undefined>;

export function buildBackupCapability(env: Env): CapabilityStatus {
  const missing = missingBackupVars(env);
  return {
    id: 'b2Backups',
    title: 'Зашифрованные бэкапы БД в Backblaze B2',
    on: missing.length === 0,
    envVars: [...BACKUP_REQUIRED_ENV_VARS, ...BACKUP_OPTIONAL_ENV_VARS],
    offReason:
      'Бэкапы в B2 не запускаются: не заданы ' +
      `${missing.join(', ') || 'переменные бэкапов'} ` +
      '(единственная копия данных — бэкапы хостинга).',
    files: ['deploy/backup-scheduler.cjs'],
    critical: false,
  };
}
