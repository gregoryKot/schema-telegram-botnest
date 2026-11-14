// Суффикс <title> зависит от хоста (решение владельца, #1158): продукту —
// название приложения, визитке — имя автора. alias — хост из
// PRACTICE_ALIAS_HOSTS, тот же флаг, что переписывает canonical и og:url.
const PRODUCT_TITLE_SUFFIX = 'Всё по схеме';
const AUTHOR_TITLE_SUFFIX = 'Григорий Котляревский';

export const seoTitle = (title: string, alias: boolean): string =>
  `${title} – ${alias ? AUTHOR_TITLE_SUFFIX : PRODUCT_TITLE_SUFFIX}`;
