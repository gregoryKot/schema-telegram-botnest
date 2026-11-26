import type { ReferenceItem } from './guideReferenceModel';
import { bodyKey, snippet, type ReferenceBody } from './guideReferenceBody';
import { nameCovered, nameHas } from './guideReferenceName';
import { findTerm, type QueryTerm } from '../../../../shared/src/search/searchQuery';

// Вес листа в выдаче «Справочника»: слово в названии листа весит больше, чем в подписи группы, а та — больше,
// чем в тексте; название, покрытое запросом целиком, — выше всех. В тексте ищутся слова от трёх букв — иначе подходит всё.
const MIN_BODY_WORD = 3;
const WEIGHT = { name: 3, title: 2, body: 1, wholeName: 3 };

/** Вес листа по запросу и кусок текста под название; ни одно слово не нашлось — null. */
export function rankItem(item: ReferenceItem, title: string, terms: QueryTerm[], body?: ReferenceBody): { item: ReferenceItem; score: number } | null {
  let score = 0;
  let sub: string | undefined;
  for (const term of terms) {
    if (nameHas(item, term)) { score += WEIGHT.name; continue; }
    if (findTerm(title, term, false)) { score += WEIGHT.title; continue; }
    if (term.word.length < MIN_BODY_WORD) continue;
    for (const paragraph of body?.get(bodyKey(item)) ?? []) {
      const found = findTerm(paragraph, term);
      if (!found) continue;
      score += WEIGHT.body;
      sub ??= snippet(paragraph, found);
      break;
    }
  }
  if (score === 0) return null;
  if (nameCovered(item, terms, MIN_BODY_WORD)) score += WEIGHT.wholeName;
  return { item: sub === undefined ? item : { ...item, sub }, score };
}
