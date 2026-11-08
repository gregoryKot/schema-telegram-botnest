// SSRF-щит подписки (push-endpoint.ts): сервер делает POST на адрес,
// присланный клиентом, поэтому список хостов проверяется в обе стороны —
// образцы принимаются, контрольные образцы (похожие, но чужие) — нет.
import {
  checkPushEndpoint,
  hashEndpoint,
  pushServiceOf,
} from './push-endpoint';
import { validPushKeys } from './push-keys';

describe('checkPushEndpoint — только https и только push-сервисы браузеров', () => {
  it.each([
    ['https://fcm.googleapis.com/fcm/send/abc', 'fcm'],
    ['https://android.googleapis.com/gcm/send/abc', 'fcm'],
    ['https://updates.push.services.mozilla.com/wpush/v2/abc', 'mozilla'],
    ['https://eu.push.services.mozilla.com/wpush/v2/abc', 'mozilla'],
    ['https://web.push.apple.com/QGx', 'apple'],
    ['https://api.push.apple.com/3/device/x', 'apple'],
    ['https://wns2-par02p.notify.windows.com/w/?token=x', 'wns'],
    ['https://FCM.GoogleAPIs.com/fcm/send/abc', 'fcm'],
  ])('%s → %s', (endpoint, service) => {
    expect(checkPushEndpoint(endpoint)).toEqual({
      ok: true,
      host: new URL(endpoint).hostname,
      service,
    });
    expect(pushServiceOf(endpoint)).toBe(service);
  });

  it.each([
    ['хост-приставка', 'https://fcm.googleapis.com.evil.com/x'],
    ['http вместо https', 'http://fcm.googleapis.com/fcm/send/x'],
    ['localhost', 'https://localhost/x'],
    ['внутренний адрес', 'https://127.0.0.1/x'],
    ['порт', 'https://fcm.googleapis.com:8443/fcm/send/x'],
    ['учётные данные', 'https://user:pw@fcm.googleapis.com/fcm/send/x'],
    ['суффикс без точки', 'https://evilpush.apple.com/x'],
    ['чужой домен с похожим именем', 'https://notify.windows.com.evil.ru/x'],
    ['соседний сервис Google', 'https://www.googleapis.com/x'],
  ])('отказ: %s', (_why, endpoint) => {
    const verdict = checkPushEndpoint(endpoint);
    expect(verdict.ok).toBe(false);
    expect(pushServiceOf(endpoint)).toBeNull();
  });

  it('не URL — отказ без имени хоста', () => {
    expect(checkPushEndpoint('не адрес')).toEqual({ ok: false, host: null });
  });

  it('хэш адреса — sha256 hex, одинаковый для одного адреса', () => {
    const a = hashEndpoint('https://fcm.googleapis.com/fcm/send/a');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEndpoint('https://fcm.googleapis.com/fcm/send/a')).toBe(a);
    expect(hashEndpoint('https://fcm.googleapis.com/fcm/send/b')).not.toBe(a);
  });
});

describe('validPushKeys — ключи шифрования подписки', () => {
  const pub = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]);
  const auth = Buffer.alloc(16, 2);

  it('base64url без и с «=» — принимается', () => {
    expect(
      validPushKeys(pub.toString('base64url'), auth.toString('base64url')),
    ).toBe(true);
    // «+» и «/» — обычный base64, не base64url.
    const plain = Buffer.alloc(16, 0xfb).toString('base64');
    expect(plain).toMatch(/[+/]/);
    expect(validPushKeys(pub.toString('base64url'), plain)).toBe(false);
    const padded = auth.toString('base64url') + '==';
    expect(validPushKeys(pub.toString('base64url'), padded)).toBe(true);
  });

  it.each([
    ['ключ короче 65 байт', Buffer.alloc(64, 4), auth],
    ['ключ не несжатый (первый байт не 0x04)', Buffer.alloc(65, 2), auth],
    ['секрет не 16 байт', pub, Buffer.alloc(12, 2)],
  ])('отказ: %s', (_why, p, a) => {
    expect(
      validPushKeys(p.toString('base64url'), a.toString('base64url')),
    ).toBe(false);
  });
});
