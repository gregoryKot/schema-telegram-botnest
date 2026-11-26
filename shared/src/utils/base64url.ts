// base64url → байты — одна реализация на сайт (правило №3): ключ VAPID для
// подписки на пуши (webapp/src/push/), `sub` из JWT (auth/dataOwnerGuard.ts).
//
// Паддинг `=` не нужен: atob по спецификации (forgiving-base64) принимает
// строку без него. Битая строка — исключение DOMException, его ловит вызывающий.

/** base64url (или обычный base64) → байты. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** base64url с текстом в UTF-8 → строка (кириллица не превращается в мусор). */
export function base64UrlToText(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}
