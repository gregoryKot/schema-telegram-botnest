// Атрибуция заявки: страница + referrer в момент отправки. Только
// структурные данные (host/путь и referrer браузера; для чужих доменов
// браузер сам режет его до origin) — без PII. Уходит строкой «Откуда»
// в уведомление админу, в БД слот-брони хранится открыто (не шифруется).
export function leadSource(): string | undefined {
  const page = `${location.hostname}${location.pathname}${location.hash}`;
  const ref = document.referrer;
  const s = ref ? `${page} ← ${ref}` : page;
  return s.slice(0, 200) || undefined;
}
