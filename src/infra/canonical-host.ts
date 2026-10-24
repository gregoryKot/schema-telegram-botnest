// Единый источник «какие хосты 301-редиректятся на канонический apex»
// (правило «одна механика — один компонент»). Раньше список хостов жил
// только в main.ts; инцидент 2026-09-16 — адрес возврата OAuth
// (GOOGLE_REDIRECT_URI) был настроен на один из этих хостов, и редирект
// колбэка (oauth-host.ts) гонял запрос по кругу с этим же мидлваром →
// ERR_TOO_MANY_REDIRECTS у Google и VK разом. main.ts и oauth-host.ts
// обязаны сверяться с ОДНИМ списком, а не с двумя копиями.

export const CANONICAL_HOST = 'schemehappens.ru';
const WWW_CANONICAL_HOST = `www.${CANONICAL_HOST}`;
// Прежние домены проекта («СхемаЛаб») — 301 на текущий бренд, чтобы старые
// ссылки и SEO не потерялись.
const LEGACY_HOSTS = new Set(['schemalab.ru', 'www.schemalab.ru']);

/**
 * true — хост подлежит хостовому 301-редиректу на канонический apex
 * (legacy-домен или www.). Алиасы (kotlarewski.ru/.gr, ALIAS_DOMAINS в
 * app.module.ts) сюда НЕ входят — они обслуживаются как есть, редиректится
 * только протокол (http → https, отдельно в main.ts, хоста не касается).
 */
export function isRedirectedHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === WWW_CANONICAL_HOST || LEGACY_HOSTS.has(h);
}

/**
 * Куда 301-редиректить запрос с этого хоста (тот же путь+query), или null —
 * хост уже канонический либо это алиас-домен, которого хостовый редирект не
 * касается.
 */
export function canonicalRedirectTarget(
  host: string,
  url: string,
): string | null {
  if (!isRedirectedHost(host)) return null;
  return `https://${CANONICAL_HOST}${url}`;
}
