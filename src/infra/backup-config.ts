// Конфигурация зашифрованных бэкапов БД в S3-совместимое хранилище —
// Cloudflare R2 (аудит D-2). Сам прогон живёт вне src/ —
// deploy/backup-scheduler.cjs (там нужен child_process, src/** его
// использовать не вправе); здесь только общее знание «что включает бэкапы»,
// на которое смотрят реестр возможностей, проба самопроверки и кросс-проверка
// env. Список обязательных переменных планировщика (REQUIRED_ENV там = эти
// пять + DATABASE_URL) сверяется с этим файлом тестом backup-scheduler.spec.ts
// (правило №4).
import type { S3Config } from './s3-list-objects';

type Env = Record<string, string | undefined>;

/** Без любой из них планировщик не стартует (см. deploy/backup-scheduler.cjs). */
export const BACKUP_REQUIRED_ENV_VARS = [
  'BACKUP_S3_ENDPOINT',
  'BACKUP_S3_BUCKET',
  'BACKUP_S3_ACCESS_KEY_ID',
  'BACKUP_S3_SECRET_ACCESS_KEY',
  'BACKUP_ENCRYPTION_KEY',
] as const;

/**
 * Срок хранения бэкапов: от недели до 30 дней, по умолчанию 30. Потолок —
 * обещание политики конфиденциальности (глава 6: удалённые из базы данные
 * исчезают из копий за 30 дней, ч. 4–5 ст. 21 152-ФЗ). Держат его
 * scripts/backup-upload.sh и формат env; сверка с политикой —
 * src/test-support/gates/backup-retention-policy.spec.ts.
 */
export const BACKUP_RETENTION_MIN_DAYS = 7;
export const BACKUP_RETENTION_MAX_DAYS = 30;

/** Необязательные: срок хранения (30 дней) и регион подписи (у R2 — `auto`). */
export const BACKUP_OPTIONAL_ENV_VARS = [
  'BACKUP_RETENTION_DAYS',
  'BACKUP_S3_REGION',
] as const;

/** Регион подписи по умолчанию — тот, что требует R2 (так же в scripts/s3-api.sh). */
export const BACKUP_S3_DEFAULT_REGION = 'auto';

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

/** Доступ к бакету из env — тот же набор, что читает scripts/s3-api.sh. */
export function backupS3Config(env: Env): S3Config {
  const get = (k: string) => env[k]?.trim() ?? '';
  return {
    endpoint: get('BACKUP_S3_ENDPOINT'),
    bucket: get('BACKUP_S3_BUCKET'),
    accessKeyId: get('BACKUP_S3_ACCESS_KEY_ID'),
    secretAccessKey: get('BACKUP_S3_SECRET_ACCESS_KEY'),
    region: get('BACKUP_S3_REGION') || BACKUP_S3_DEFAULT_REGION,
  };
}
