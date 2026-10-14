// Ещё кросс-проверки env для бэкапов БД: подключаются в BACKUP_CROSS_CHECKS
// (env-check.backup.ts). Отдельный файл — соседние под храповиком размера
// (правило №10).
import type { CrossCheck } from './env-check';
import { missingBackupVars } from './backup-config';
import { isVpsTarget } from './deploy-target';

export const BACKUP_EXTRA_CROSS_CHECKS: CrossCheck[] = [
  {
    // Аудит 2026-10 (infra#11): на VPS pgdata — единственная копия базы, а
    // «бэкапы выключены» штатно выглядело как «всё в порядке». В production
    // это ошибка старта: error владельцу в DM и строка в блоке «Переменные».
    id: 'vpsRequiresBackups',
    check: (env, mode) => {
      if (mode !== 'production' || !isVpsTarget(env)) return null;
      const missing = missingBackupVars(env);
      return missing.length === 0
        ? null
        : 'на VPS (DEPLOY_TARGET=vps) бэкапы в B2 обязательны — единственная ' +
            `копия базы лежит на диске сервера; не задано: ${missing.join(', ')}`;
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
