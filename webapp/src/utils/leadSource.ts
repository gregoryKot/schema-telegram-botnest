// Атрибуция заявки: страница (из query — только метка ?from=app_<место> моста
// к терапевту; utm, коды входа и прочее отбрасываются) + referrer в момент отправки. Только
// структурные данные (host/путь и referrer браузера; для чужих доменов
// браузер сам режет его до origin) — без PII. Уходит строкой «Откуда»
// в уведомление админу, в БД слот-брони хранится открыто (не шифруется).
/** `?from=app_<место>` — единственный параметр query, который попадает в источник. */
function appFromQuery(): string {
  const from = new URLSearchParams(location.search).get('from');
  return from && /^app_[a-z_]{1,32}$/.test(from) ? `?from=${from}` : '';
}

export function leadSource(): string | undefined {
  const page = `${location.hostname}${location.pathname}${appFromQuery()}${location.hash}`;
  const ref = document.referrer;
  const s = ref ? `${page} ← ${ref}` : page;
  return s.slice(0, 200) || undefined;
}
