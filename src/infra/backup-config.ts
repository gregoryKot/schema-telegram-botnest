// Конфигурация зашифрованных бэкапов БД в Backblaze B2 (аудит D-2).
// Сам прогон живёт вне src/ — deploy/backup-scheduler.cjs (там нужен
// child_process, src/** его использовать не вправе); здесь только общее знание
// «что включает бэкапы», на которое смотрят реестр возможностей, проба
// самопроверки и кросс-проверка env. Список обязательных переменных
// планировщика (REQUIRED_ENV там = эти четыре + DATABASE_URL) сверяется с
// этим файлом тестом backup-scheduler.spec.ts (правило №4).

type Env = Record<string, string | undefined>;

/** Без любой из них планировщик не стартует (см. deploy/backup-scheduler.cjs). */
export const BACKUP_REQUIRED_ENV_VARS = [
  'B2_KEY_ID',
  'B2_APP_KEY',
  'B2_BUCKET',
  'BACKUP_ENCRYPTION_KEY',
] as const;

/** Необязательные настройки бэкапов (по умолчанию — 90 дней хранения). */
export const BACKUP_OPTIONAL_ENV_VARS = ['BACKUP_RETENTION_DAYS'] as const;

const isSet = (env: Env, key: string): boolean => Boolean(env[key]?.trim());

/** Какие из обязательных переменных бэкапов не заданы. */
export function missingBackupVars(env: Env): string[] {
  return BACKUP_REQUIRED_ENV_VARS.filter((k) => !isSet(env, k));
}

/**
 * off — не настроено вовсе (штатно); partial — задана часть (поломка
 * конфигурации: бэкапы думают, что включены, а не запускаются); on — всё есть.
 */
export function backupConfigState(env: Env): 'off' | 'partial' | 'on' {
  const missing = missingBackupVars(env).length;
  if (missing === 0) return 'on';
  return missing === BACKUP_REQUIRED_ENV_VARS.length ? 'off' : 'partial';
}
