// Записи реестра env-переменных (см. env-registry.ts) — бэкапы БД в
// Yandex Object Storage (аудит D-2). Читаются deploy/backup-scheduler.cjs и
// scripts/backup-*.sh (вход — scripts/s3-api.sh); в src/** их видят проба
// самопроверки и реестр возможностей (backup-config.ts). Группа — infra.
import { EnvVarSpec, formats } from './env-registry';
import {
  BACKUP_RETENTION_MAX_DAYS as MAX,
  BACKUP_RETENTION_MIN_DAYS as MIN,
} from './backup-config';

/** Неделя–30 дней: те же границы держит scripts/backup-upload.sh. */
const retentionDays = (value: string): string | null => {
  const notInteger = formats.integer(value);
  if (notInteger) return notInteger;
  const days = Number(value);
  if (days < MIN)
    return `меньше ${MIN} дней — скрипт бэкапа откажется работать`;
  return days <= MAX
    ? null
    : `больше ${MAX} дней — политика конфиденциальности обещает ${MAX}, скрипт бэкапа хранит ${MAX}`;
};

/** Только Yandex Object Storage, без бакета: копия не должна уехать за рубеж молча. */
const s3Endpoint = (value: string): string | null => {
  const notUrl = formats.httpsUrl(value);
  if (notUrl) return notUrl;
  const url = new URL(value);
  return url.origin === 'https://storage.yandexcloud.net' &&
    url.pathname.replace(/\/+$/, '') === '' &&
    !url.search
    ? null
    : 'ожидался только `https://storage.yandexcloud.net` (без пути)';
};

/** Имя бакета по правилам S3/Yandex Object Storage: 3–63 символа, строчные буквы, цифры, дефис. */
const bucketName = (value: string): string | null =>
  /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value)
    ? null
    : 'имя бакета — 3–63 символа: строчные латинские буквы, цифры, дефис';

/** Ключ доступа уходит в подпись как есть: пробел внутри — почти всегда ошибка копирования. */
export const accessKey = (value: string): string | null =>
  /^\S+$/.test(value) ? null : 'пустое значение или пробел внутри ключа';

export const BACKUP_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'BACKUP_ENCRYPTION_KEY',
    purpose:
      'Ключ шифрования бэкапов БД (AES-256, ≥ 32 символов) — ОТДЕЛЬНЫЙ от ' +
      'ENCRYPTION_KEY: утечка одного не открывает другое. Хранить ещё и вне ' +
      'Amvera: без него бэкап не расшифровать.',
    requiredInProd: false,
    format: formats.secret32,
    group: 'infra',
  },
  {
    name: 'BACKUP_RETENTION_DAYS',
    purpose:
      'Сколько дней хранить бэкапы в бакете (от 7 до 30, по умолчанию 30: ' +
      'столько обещает политика конфиденциальности) — старше удаляются после ' +
      'каждого успешного бэкапа.',
    requiredInProd: false,
    format: retentionDays,
    group: 'infra',
  },
  {
    name: 'BACKUP_S3_ACCESS_KEY_ID',
    purpose:
      'Идентификатор статического ключа сервисного аккаунта Yandex Cloud ' +
      '(права только на бакет бэкапов) — пара к BACKUP_S3_SECRET_ACCESS_KEY.',
    requiredInProd: false,
    format: accessKey,
    group: 'infra',
  },
  {
    name: 'BACKUP_S3_BUCKET',
    purpose:
      'Имя приватного бакета Yandex Object Storage для зашифрованных бэкапов ' +
      'БД — без него бэкапы не запускаются (deploy/backup-scheduler.cjs).',
    requiredInProd: false,
    format: bucketName,
    group: 'infra',
  },
  {
    name: 'BACKUP_S3_ENDPOINT',
    purpose:
      'Адрес S3-API без бакета: только https://storage.yandexcloud.net (за рубеж копия не уходит).',
    requiredInProd: false,
    format: s3Endpoint,
    group: 'infra',
  },
  {
    name: 'BACKUP_S3_REGION',
    purpose:
      'Регион в подписи запросов к Yandex Object Storage — по умолчанию ' +
      'ru-central1; задавать не нужно.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'infra',
  },
  {
    name: 'BACKUP_S3_SECRET_ACCESS_KEY',
    purpose:
      'Секретная часть статического ключа сервисного аккаунта Yandex Cloud — вместе с BACKUP_S3_ACCESS_KEY_ID, ' +
      'BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET и BACKUP_ENCRYPTION_KEY включает ' +
      'бэкапы БД.',
    requiredInProd: false,
    format: accessKey,
    group: 'infra',
  },
];
