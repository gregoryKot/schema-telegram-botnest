// Ключи шифрования подписки (RFC 8291): p256dh — публичный ключ браузера
// P-256 в несжатой форме (65 байт, первый 0x04), auth — секрет 16 байт. Оба
// приходят base64url из PushSubscription.toJSON(). Битые ключи web-push
// отверг бы только при отправке — проверяем при сохранении (ответ 400).
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

function decode(value: string): Buffer | null {
  if (!B64URL.test(value)) return null;
  return Buffer.from(value.replace(/=+$/, ''), 'base64url');
}

export function validPushKeys(p256dh: string, auth: string): boolean {
  const pub = decode(p256dh);
  const secret = decode(auth);
  return (
    pub !== null &&
    pub.length === 65 &&
    pub[0] === 0x04 &&
    secret !== null &&
    secret.length === 16
  );
}
