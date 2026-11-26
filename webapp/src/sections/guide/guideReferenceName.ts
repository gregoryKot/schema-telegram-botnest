// Название листа «Справочника» в поиске: само название и поисковые синонимы схем и режимов
// (shared/src/schemaTherapy/searchAliases.ts) — другой перевод находит тот же лист.
import { searchAliases } from '../../../../shared/src/schemaTherapy/searchAliases';
import { findTerm, textTokens, type QueryTerm } from '../../../../shared/src/search/searchQuery';
import type { ReferenceItem } from './guideReferenceModel';

/** Слово запроса есть в названии листа или в его синониме (синоним — только по стему). */
export function nameHas(item: ReferenceItem, term: QueryTerm): boolean {
  return findTerm(item.name, term) !== null || searchAliases(item.kind, item.id).some((alias) => findTerm(alias, term, false) !== null);
}

/** Запрос покрывает название (или один из синонимов) целиком; слова короче `minWord` не в счёт. */
export function nameCovered(item: ReferenceItem, terms: QueryTerm[], minWord: number): boolean {
  return [item.name, ...searchAliases(item.kind, item.id)].some((name) => {
    const words = textTokens(name).filter((t) => t.word.length >= minWord);
    return words.length > 0 && words.every((t) => terms.some((q) => t.stem.startsWith(q.stem)));
  });
}
