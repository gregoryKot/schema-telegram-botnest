// Срок и место хранения бэкапов обещаны в политике конфиденциальности, и
// обещание обязано совпадать с тем, что делает скрипт бэкапа.
//
// Политика (`webapp/src/pages/PrivacyPage.tsx`) говорит человеку: данные
// уничтожаются в течение 30 дней, резервные копии хранятся «не дольше 30 дней»
// в Cloudflare R2. Держит это `scripts/backup-upload.sh` (срок по умолчанию и
// потолок) и формат `BACKUP_RETENTION_DAYS` в реестре env. До сверки 2026-10-22
// политика обещала 30 дней, а копии жили 90, и про R2 в ней не было ни слова:
// скрипт и юридический текст живут в разных пакетах, и никакой гейт на них
// вместе не смотрел (тот же класс, что `booking-retention-policy.spec.ts`,
// правило №4 — два места, обязанных совпадать, фиксируются тестом).
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { BACKUP_RETENTION_MAX_DAYS as MAX } from '../../infra/backup-config';
import { BACKUP_ENV_ENTRIES } from '../../infra/env-registry.entries.backup';

const ROOT = resolve(__dirname, '..', '..', '..');
const PRIVACY_PAGE = 'webapp/src/pages/PrivacyPage.tsx';
const PROCESSORS = 'webapp/src/pages/privacy/processors.ts';
const UPLOAD_SCRIPT = 'scripts/backup-upload.sh';

/** Текст файла с переносами строк JSX, схлопнутыми в пробел. */
const read = (rel: string): string =>
  readFileSync(join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

const policyPhrase = (days: number): string =>
  `Резервные копии базы данных хранятся в зашифрованном виде не дольше ${days} дней`;

const retentionFormat = (value: string): string | null => {
  const spec = BACKUP_ENV_ENTRIES.find(
    (e) => e.name === 'BACKUP_RETENTION_DAYS',
  );
  if (!spec) throw new Error('BACKUP_RETENTION_DAYS пропал из реестра env');
  return spec.format(value);
};

describe('срок бэкапов: скрипт и env ↔ политика конфиденциальности', () => {
  it(`${PRIVACY_PAGE}: срок копий — потолок из backup-config`, () => {
    expect(read(PRIVACY_PAGE)).toContain(policyPhrase(MAX));
  });

  it(`${UPLOAD_SCRIPT}: срок по умолчанию и потолок — те же ${MAX} дней`, () => {
    const script = read(UPLOAD_SCRIPT);
    expect(script).toContain(
      `RETENTION_DAYS="\${BACKUP_RETENTION_DAYS:-${MAX}}"`,
    );
    expect(script).toContain(`if [ "$RETENTION_DAYS" -gt ${MAX} ]; then`);
    expect(script).toContain(`RETENTION_DAYS=${MAX} fi`);
  });

  it('формат env: потолок принимается, на день больше — нет', () => {
    expect(retentionFormat(String(MAX))).toBeNull();
    expect(retentionFormat(String(MAX + 1))).not.toBeNull();
  });

  it('хранилище бэкапов названо в главе 7 и в списке иностранных сервисов', () => {
    expect(read(PRIVACY_PAGE)).toContain(
      'резервные копии базы данных хранятся в облачном хранилище Cloudflare R2',
    );
    expect(read(PROCESSORS)).toContain(
      "name: 'Cloudflare R2 (Cloudflare, Inc.)'",
    );
  });

  it('контрольный образец: другой срок в политике — пин краснеет', () => {
    // Совпадение не случайно, а именно по числу из константы (правило №15 п.2).
    expect(read(PRIVACY_PAGE)).not.toContain(policyPhrase(MAX + 1));
    expect(read(UPLOAD_SCRIPT)).not.toContain(
      `BACKUP_RETENTION_DAYS:-${MAX + 1}}`,
    );
  });
});
