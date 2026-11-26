// Адреса-синонимы страницы ссылок визитки: каждый отвечает 301 на основной адрес,
// строка запроса сохраняется (по `utm_source` считается источник клика).

export const LINKS_PAGE_PATH = '/privet';
/** Зеркало `LINKS_PAGE_ALIASES` в webapp/src/pages/links/linksAliases.ts (маршруты-редиректы
 *  SPA) — сверка в practice-domain.middleware.spec.ts. От списка строится и robots. */
export const LINKS_PAGE_ALIASES: readonly string[] = ['/links', '/hi', '/me'];

/** Адрес для `Location` (тот же хост) либо null, если путь — не синоним. */
export function practicePageRedirect(
  path: string,
  originalUrl: string,
): string | null {
  if (!LINKS_PAGE_ALIASES.includes(path)) return null;
  const query = originalUrl.indexOf('?');
  return query === -1
    ? LINKS_PAGE_PATH
    : LINKS_PAGE_PATH + originalUrl.slice(query);
}
