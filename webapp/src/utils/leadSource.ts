// Атрибуция заявки: страница + referrer в момент отправки. Только структурные данные
// (host/путь, `?from=app_<место>` моста к терапевту, якорь раздела из белого списка;
// referrer чужих доменов браузер сам режет до origin) — без PII. Уходит строкой «Откуда»
// в уведомление админу, в БД слот-брони хранится открыто (не шифруется).
function appFromQuery(): string {
  const from = new URLSearchParams(location.search).get('from');
  return from && /^app_[a-z_]{1,32}$/.test(from) ? `?from=${from}` : '';
}
// Якоря разделов визитки (id секций LandingPage); фрагмент целиком нёс бы что угодно (S21).
const SECTIONS = new Set(['#about', '#approach', '#booking', '#education', '#faq', '#prices', '#process', '#work']);

export function leadSource(): string | undefined {
  const page = `${location.hostname}${location.pathname}${appFromQuery()}${SECTIONS.has(location.hash) ? location.hash : ''}`;
  const ref = document.referrer;
  const s = ref ? `${page} ← ${ref}` : page;
  return s.slice(0, 200) || undefined;
}
