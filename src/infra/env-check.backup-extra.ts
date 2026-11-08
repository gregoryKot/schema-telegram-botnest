// Ещё кросс-проверки env для бэкапов БД: подключаются в BACKUP_CROSS_CHECKS
// (env-check.backup.ts). Отдельный файл — соседние под храповиком размера
// (правило №10).
import type { CrossCheck } from './env-check';

export const BACKUP_EXTRA_CROSS_CHECKS: CrossCheck[] = [
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
