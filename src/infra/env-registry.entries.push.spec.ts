import { generateVAPIDKeys } from 'web-push';
import { PUSH_ENV_ENTRIES } from './env-registry.entries.push';

const format = (name: string) => {
  const e = PUSH_ENV_ENTRIES.find((x) => x.name === name);
  if (!e) throw new Error(name);
  return e.format;
};

describe('env: ключи уведомлений в приложении', () => {
  const keys = generateVAPIDKeys();

  it('настоящие ключи web-push проходят формат', () => {
    expect(format('VAPID_PUBLIC_KEY')(keys.publicKey)).toBeNull();
    expect(format('VAPID_PRIVATE_KEY')(keys.privateKey)).toBeNull();
  });

  it('перепутанные местами или не base64url — с причиной', () => {
    expect(format('VAPID_PUBLIC_KEY')(keys.privateKey)).toContain('65 байт');
    expect(format('VAPID_PRIVATE_KEY')(keys.publicKey)).toContain('32 байт');
    expect(format('VAPID_PRIVATE_KEY')('a+b/c=')).toContain('base64url');
  });

  it('контакт — https-адрес или mailto:', () => {
    expect(format('VAPID_SUBJECT')('https://schemehappens.ru')).toBeNull();
    expect(format('VAPID_SUBJECT')('mailto:owner@example.com')).toBeNull();
    expect(format('VAPID_SUBJECT')('http://schemehappens.ru')).not.toBeNull();
  });
});
