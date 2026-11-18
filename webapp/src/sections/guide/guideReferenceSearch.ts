import { runStarts } from '../../../../shared/src/utils/runStarts';
import { REFERENCE_TABS, type Reference, type ReferenceGroup, type ReferenceItem } from './guideReferenceModel';
import type { ReferenceBody } from './guideReferenceBody';
import { leafGroups } from './guideReferenceCoping';
import { parseSearchQuery } from '../../../../shared/src/search/searchQuery';
import { rankItem } from './guideReferenceRank';

/**
 * Поиск «Справочника» терапевта по названиям и текстам листов во всех разделах (модель — guideReferenceModel.ts).
 * Запрос разбирает parseSearchQuery (служебные слова выпадают, падеж не важен); лист подходит, когда нашлось
 * хотя бы одно слово. Выдача — по убыванию веса (rankItem), при равном весе — порядок реестра. Соседние строки
 * одной группы идут серией: у серии один лист со знаком у подписи (runStarts); у техник и «Для терапевта» подпись —
 * имя раздела. Пустой запрос и запрос из служебных слов — пустой список. Подгруппа листа (копинг) — своя группа.
 */
export interface ReferenceHit {
  /** Ключ группы листа в выдаче: раздел и группа. */
  key: string;
  /** Подпись группы; у листа без группы — имя раздела. */
  title: string;
  /** Имя раздела справочника («Режимы», «Схемы»…). */
  section: string;
  look: ReferenceGroup['look'];
  /** Лист; когда слово нашлось в тексте, `sub` — кусок абзаца. */
  item: ReferenceItem;
  /** Кусок абзаца с найденным словом; совпало только название или подпись — нет. */
  snippet?: string;
  score: number;
}

/** Плоская выдача по убыванию веса: ею пользуются список «Справочника» и общий поиск (палитра ⌘K). */
export function rankReference(ref: Reference, query: string, body?: ReferenceBody): ReferenceHit[] {
  const terms = parseSearchQuery(query);
  if (terms.length === 0) return [];
  const hits: ReferenceHit[] = REFERENCE_TABS.flatMap((tab) => leafGroups(ref[tab.id]).flatMap((group) => {
    const title = group.title ?? tab.label;
    return group.items.flatMap((item) => {
      const hit = rankItem(item, title, terms, body);
      if (!hit) return [];
      const snippet = hit.item === item ? undefined : hit.item.sub;
      return [{ ...hit, snippet, key: `${tab.id}:${group.key}`, title, section: tab.label, look: group.look }];
    });
  }));
  return hits.sort((a, b) => b.score - a.score); // сортировка устойчива: при равном весе остаётся порядок реестра
}

export function searchReference(ref: Reference, query: string, body?: ReferenceBody): ReferenceGroup[] {
  const hits = rankReference(ref, query, body);
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
