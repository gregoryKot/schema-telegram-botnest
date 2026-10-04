// Записи реестра env-переменных (см. env-registry.ts) — бэкапы БД в B2
// (аудит D-2). Читаются планировщиком deploy/backup-scheduler.cjs и скриптом
// scripts/backup-to-b2.sh; в src/** их видят проба самопроверки и реестр
// возможностей (backup-config.ts). Группа — infra.
import { EnvVarSpec, formats } from './env-registry';

/** Не меньше недели — то же ограничение держит scripts/backup-to-b2.sh. */
const retentionDays = (value: string): string | null => {
  const notInteger = formats.integer(value);
  if (notInteger) return notInteger;
  return Number(value) >= 7
    ? null
    : 'меньше 7 дней — скрипт бэкапа откажется работать';
};

export const BACKUP_ENV_ENTRIES: EnvVarSpec[] = [
  {
    name: 'B2_APP_KEY',
    purpose:
      'Секрет ключа приложения Backblaze B2 (ключ только на один бакет) — ' +
      'вместе с B2_KEY_ID, B2_BUCKET и BACKUP_ENCRYPTION_KEY включает бэкапы БД.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'infra',
  },
  {
    name: 'B2_BUCKET',
    purpose:
      'Имя приватного бакета B2 для зашифрованных бэкапов БД — без него ' +
      'бэкапы не запускаются (deploy/backup-scheduler.cjs).',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'infra',
  },
  {
    name: 'B2_KEY_ID',
    purpose: 'Идентификатор ключа приложения Backblaze B2 — пара к B2_APP_KEY.',
    requiredInProd: false,
    format: formats.nonEmpty,
    group: 'infra',
  },
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
      'Сколько дней хранить бэкапы в B2 (по умолчанию 90, не меньше 7) — ' +
      'старше удаляются после каждого успешного бэкапа.',
    requiredInProd: false,
    format: retentionDays,
    group: 'infra',
  },
];
