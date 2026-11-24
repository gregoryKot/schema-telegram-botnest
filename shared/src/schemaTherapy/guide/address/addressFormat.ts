/**
 * Адрес раздела «Справочника» (#1484): `<вид>:<id статьи>/<путь раздела>`,
 * например `schema:subjugation/coping.surrender`, `technique:chairwork/when`.
 * Адреса не пишут руками — их выводит обход статей (addressArticles.ts).
 */
export const GUIDE_ARTICLE_KINDS = [
  'schema',
  'mode',
  'technique',
  'note',
  'concern',
  'phase',
  'need',
] as const;
export type GuideArticleKind = (typeof GUIDE_ARTICLE_KINDS)[number];

export interface GuideAddressParts {
  kind: GuideArticleKind;
  articleId: string;
  /** Путь раздела: поле статьи, у вложенного — через точку (`coping.surrender`). */
  path: string;
}

const SEGMENT = '[A-Za-z][A-Za-z0-9_]*';
const ADDRESS_RE = new RegExp(
  `^(${GUIDE_ARTICLE_KINDS.join('|')}):([A-Za-z0-9_-]+)/(${SEGMENT}(?:\\.${SEGMENT})*)$`,
);

export function formatAddress(a: GuideAddressParts): string {
  return `${a.kind}:${a.articleId}/${a.path}`;
}

/** Разбор адреса; null — строка не адрес (чужой вид, пустой путь, лишние знаки). */
export function parseAddress(address: string): GuideAddressParts | null {
  const m = ADDRESS_RE.exec(address);
  if (!m) return null;
  return { kind: m[1] as GuideArticleKind, articleId: m[2], path: m[3] };
}
