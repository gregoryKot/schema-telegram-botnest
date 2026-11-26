// Адрес страницы ссылок визитки и его синонимы: синоним переводит на основной адрес.
// Серверная копия (301 и robots) — src/practice-domain.redirects.ts, сверка — в
// src/practice-domain.middleware.spec.ts.
export const LINKS_PAGE_PATH = '/privet';
export const LINKS_PAGE_ALIASES: readonly string[] = ['/links', '/hi', '/me'];
