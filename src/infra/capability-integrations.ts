// Записи реестра возможностей, которые живут рядом со своей интеграцией, а не
// в capability-report.ts (файл под храповиком размера, правило №10).
import { buildOauthRedirectCapability } from '../auth/oauth-redirect-config';
import { buildRobokassaCapability } from '../booking/robokassa-capability';
import { buildBackupCapability } from './backup-capability';
import { buildEncryptionMigrationCapability } from './encryption-migration-capability';
import type { CapabilityStatus } from './capability-report';

export function buildIntegrationCapabilities(
  env: Record<string, string | undefined>,
): CapabilityStatus[] {
  return [
    // Инцидент 2026-09-16: сама запись — в src/auth/oauth-redirect-config.ts.
    buildOauthRedirectCapability(env),
    buildBackupCapability(env),
    buildRobokassaCapability(env),
    buildEncryptionMigrationCapability(env),
  ];
}
