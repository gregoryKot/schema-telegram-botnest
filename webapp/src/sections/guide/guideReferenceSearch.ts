import { runStarts } from '../../../../shared/src/utils/runStarts';
import { REFERENCE_TABS, type Reference, type ReferenceGroup, type ReferenceItem } from './guideReferenceModel';
import { bodyKey, snippet, type ReferenceBody } from './guideReferenceBody';
import { leafGroups } from './guideReferenceCoping';
import { findTerm, parseReferenceQuery, textTokens, type QueryTerm } from './guideReferenceQuery';

/**
 * Поиск «Справочника» терапевта по названиям и текстам листов во всех разделах (модель — guideReferenceModel.ts).
 * Запрос разбирает parseReferenceQuery: служебные слова выпадают, падеж не важен. Лист подходит, когда нашлось
 * хотя бы одно слово; выдача — по убыванию веса: слово в названии листа весит больше, чем в подписи группы,
 * а та — больше, чем в тексте (`body`; в тексте ищутся слова от трёх букв — иначе подходит всё); название,
 * покрытое запросом целиком, — выше всех. При равном весе — порядок реестра. Слово нашлось только в тексте —
 * под названием кусок абзаца с ним. Найденное остаётся на листе своей группы: соседние строки одной группы
 * идут серией — у серии один лист со знаком у подписи (runStarts). У техник и «Для терапевта» групп нет:
 * подпись — имя раздела. Пустой запрос и запрос из служебных слов — пустой список. Подгруппа листа (копинг)
 * ищется как своя группа — leafGroups.
 */
const MIN_BODY_WORD = 3;
const WEIGHT = { name: 3, title: 2, body: 1, wholeName: 3 };

interface Hit { key: string; title: string; look: ReferenceGroup['look']; item: ReferenceItem; score: number }

/** Вес листа по запросу и кусок текста под название; ни одно слово не нашлось — null. */
function rank(item: ReferenceItem, title: string, terms: QueryTerm[], body?: ReferenceBody): Pick<Hit, 'item' | 'score'> | null {
  let score = 0;
  let sub: string | undefined;
  for (const term of terms) {
    if (findTerm(item.name, term)) { score += WEIGHT.name; continue; }
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
  const nameWords = textTokens(item.name).filter((t) => t.word.length >= MIN_BODY_WORD);
  if (nameWords.length > 0 && nameWords.every((t) => terms.some((q) => t.stem.startsWith(q.stem)))) score += WEIGHT.wholeName;
  return { item: sub === undefined ? item : { ...item, sub }, score };
}

export function searchReference(ref: Reference, query: string, body?: ReferenceBody): ReferenceGroup[] {
  const terms = parseReferenceQuery(query);
  if (terms.length === 0) return [];
  const hits: Hit[] = REFERENCE_TABS.flatMap((tab) => leafGroups(ref[tab.id]).flatMap((group) => {
    const title = group.title ?? tab.label;
    return group.items.flatMap((item) => {
      const hit = rank(item, title, terms, body);
      return hit ? [{ ...hit, key: `${tab.id}:${group.key}`, title, look: group.look }] : [];
    });
  }));
  hits.sort((a, b) => b.score - a.score); // сортировка устойчива: при равном весе остаётся порядок реестра
  const starts = runStarts(hits.map((h) => h.key));
  const found: ReferenceGroup[] = [];
  const seen = new Map<string, number>();
  hits.forEach(({ key, title, look, item }, i) => {
    if (starts[i]) {
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      // Группа может встретиться дважды (между её листами встал более точный чужой) — ключ листа остаётся уникальным.
      found.push({ key: n === 0 ? key : `${key}#${n}`, title, look, items: [] });
    }
    found[found.length - 1].items.push(item);
  });
  return found;
}
