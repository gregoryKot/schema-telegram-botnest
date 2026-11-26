// Запись реестра возможностей «дошифровка старых записей при старте»
// (capability-report.ts вынес её сюда: файл под храповиком размера, правило
// №10). Выключена по конфигурации — нет ENCRYPTION_KEY: в проде процесс без
// него не стартует, так что это только dev/CI. Что дошифровка дошла до конца,
// отвечает проба самопроверки `clinicalLabels`, а не эта запись.
import type { CapabilityStatus } from './capability-report';

type Env = Record<string, string | undefined>;

export function buildEncryptionMigrationCapability(env: Env): CapabilityStatus {
  return {
    id: 'legacyEncryptionMigration',
    title: 'Дошифровка старых записей при старте',
    on: Boolean(env.ENCRYPTION_KEY?.trim()),
    envVars: ['ENCRYPTION_KEY'],
    offReason:
      'Дошифровка старых записей пропущена: нет ENCRYPTION_KEY (в проде ' +
      'без него процесс вообще не стартует — см. src/utils/crypto.ts, ' +
      'здесь это только dev/CI).',
    files: [
      'src/prisma/encryption-wave2.service.ts',
      'src/prisma/encryption-wave3.service.ts',
      'src/utils/encrypt-migration.ts',
      'src/utils/encrypt-migration.rows.ts',
      'src/infra/self-check/clinical-labels-status.ts',
    ],
    critical: false,
  };
}
