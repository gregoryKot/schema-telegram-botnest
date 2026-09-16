// Собирает все группы записей (env-registry.entries.*.ts, правило №10 —
// файл рос за 300 строк одним куском) в один отсортированный по имени
// реестр (правило №13: реестры держим отсортированными).
import { EnvVarSpec } from './env-registry';
import { AUTH_ENV_ENTRIES } from './env-registry.entries.auth';
import { TELEGRAM_ENV_ENTRIES } from './env-registry.entries.telegram';
import { CHANNEL_ENV_ENTRIES } from './env-registry.entries.channel';
import { EMAIL_ENV_ENTRIES } from './env-registry.entries.email';
import { BOOKING_ENV_ENTRIES } from './env-registry.entries.booking';
import { INFRA_ENV_ENTRIES } from './env-registry.entries.infra';

export const ENV_REGISTRY: EnvVarSpec[] = [
  ...AUTH_ENV_ENTRIES,
  ...TELEGRAM_ENV_ENTRIES,
  ...CHANNEL_ENV_ENTRIES,
  ...EMAIL_ENV_ENTRIES,
  ...BOOKING_ENV_ENTRIES,
  ...INFRA_ENV_ENTRIES,
].sort((a, b) => a.name.localeCompare(b.name));
