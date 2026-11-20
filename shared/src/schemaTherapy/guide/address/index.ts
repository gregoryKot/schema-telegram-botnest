/**
 * Адреса разделов «Справочника» (#1484): перечисление, разбор, поиск текста
 * раздела, реестр переименований и таблица смыслов. Адреса выводит обход
 * статей (addressArticles.ts); сторож — address.test.ts.
 */
import type { Tr } from '../types';
import {
  formatAddress,
  parseAddress,
  type GuideArticleKind,
} from './addressFormat';
import { guideAddressArticles } from './addressArticles';
import { SECTION_TITLES } from './addressTitles';
import { normalizeAddress } from './addressRenames';

export {
  GUIDE_ARTICLE_KINDS,
  formatAddress,
  parseAddress,
} from './addressFormat';
export type { GuideAddressParts, GuideArticleKind } from './addressFormat';
export { GUIDE_ADDRESS_RENAMES, normalizeAddress } from './addressRenames';
export { GUIDE_ADDRESS_TARGETS, addressTarget } from './addressTargets';
export type {
  GuideAddressTarget,
  GuideAddressTargetRule,
} from './addressTargets';
export { guideAddressArticles } from './addressArticles';
export type { GuideAddressArticle } from './addressArticles';

/** Форма «вы» — когда форма читателя не важна (адрес от неё не зависит). */
const vyTr: Tr = (_ty, vy) => vy;

export interface ResolvedGuideAddress {
  /** Адрес после реестра переименований. */
  address: string;
  kind: GuideArticleKind;
  articleId: string;
  articleTitle: string;
  sectionTitle: string;
  text: string;
}

/** Все адреса справочника (или одного вида статьи), в порядке статей и полей. */
export function listAddresses(kind?: GuideArticleKind): string[] {
  return guideAddressArticles(vyTr, kind).flatMap((a) =>
    [...a.sections.keys()].map((path) =>
      formatAddress({ kind: a.kind, articleId: a.id, path }),
    ),
  );
}

/** Заголовок раздела, как на листе; неизвестный путь — сам путь. */
export function sectionTitle(kind: GuideArticleKind, path: string): string {
  return SECTION_TITLES[kind][path] ?? path;
}

/** Раздел по адресу (старый адрес проводится через реестр); null — раздела нет или он пуст. */
export function resolveAddress(
  address: string,
  tr: Tr = vyTr,
): ResolvedGuideAddress | null {
  const normalized = normalizeAddress(address);
  const parts = parseAddress(normalized);
  if (!parts) return null;
  const article = guideAddressArticles(tr, parts.kind).find(
    (a) => a.id === parts.articleId,
  );
  const text = article?.sections.get(parts.path);
  if (!article || !text) return null;
  return {
    address: normalized,
    kind: parts.kind,
    articleId: article.id,
    articleTitle: article.title,
    sectionTitle: sectionTitle(parts.kind, parts.path),
    text,
  };
}
