import { BACKUP_ENV_ENTRIES } from './env-registry.entries.backup';

const endpoint = BACKUP_ENV_ENTRIES.find(
  (e) => e.name === 'BACKUP_S3_ENDPOINT',
)!;

describe('BACKUP_S3_ENDPOINT: только Yandex Object Storage', () => {
  it.each([
    'https://storage.yandexcloud.net',
    'https://storage.yandexcloud.net/',
  ])('%s — принимается', (v) => expect(endpoint.format(v)).toBeNull());

  it.each([
    'https://x.r2.cloudflarestorage.com',
    'https://s3.amazonaws.com',
    'https://storage.yandexcloud.net/bucket',
    'https://storage.yandexcloud.net:8443',
  ])('%s — ошибка, подсказка называет адрес Яндекса', (v) => {
    expect(endpoint.format(v)).toContain('https://storage.yandexcloud.net');
  });
});
