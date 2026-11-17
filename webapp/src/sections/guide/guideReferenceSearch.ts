import { runStarts } from '../../../../shared/src/utils/runStarts';
import { normalizeSearchText } from '../../../../shared/src/utils/searchNormalize';
import { REFERENCE_TABS, type Reference, type ReferenceGroup, type ReferenceItem } from './guideReferenceModel';
import { bodyKey, snippet, type ReferenceBody } from './guideReferenceBody';
import { leafGroups } from './guideReferenceCoping';

/**
 * Поиск «Справочника» терапевта по названиям и текстам листов во всех разделах (модель — guideReferenceModel.ts).
 * Запрос делится на слова, лист подходит, когда каждое нашлось в названии или в тексте (`body`; в тексте ищутся
 * слова от трёх букв — иначе подходит всё). Слово нашлось только в тексте — под названием кусок абзаца с ним. Найденное остаётся на листе своей группы: строки одной группы
 * режимов или одного домена идут серией — у серии один лист со знаком у подписи, строки знак не
 * повторяют (три Критика подряд — один знак, а не три; та же «серия», что у плиток чек-ина клиента,
 * runStarts). У техник и «Для терапевта» групп нет: один лист на раздел, подпись — имя раздела, знак у
 * строки свой. Регистр и «ё/е» не различаются (matchesSearch). Пустой запрос — пустой список: экран
 * тогда показывает выбранный раздел. Подгруппа листа (копинг) ищется как своя группа — leafGroups.
 */
const MIN_BODY_WORD = 3;

export function searchReference(ref: Reference, query: string, body?: ReferenceBody): ReferenceGroup[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  /** Строка с куском текста под названием, если совпадение — в тексте листа; не подошла — null. */
  const match = (item: ReferenceItem): ReferenceItem | null => {
    const name = normalizeSearchText(item.name);
    const inBody = words.filter((w) => !name.includes(w));
    if (inBody.length === 0) return item;
    if (inBody.some((w) => w.length < MIN_BODY_WORD)) return null;
    const paragraphs = body?.get(bodyKey(item)) ?? [];
    const hits = inBody.map((w) => paragraphs.find((p) => normalizeSearchText(p).includes(w)));
    return hits[0] !== undefined && hits.every((p) => p !== undefined) ? { ...item, sub: snippet(hits[0], inBody[0]) } : null;
  };
  return REFERENCE_TABS.flatMap((tab) => {
    const hits = leafGroups(ref[tab.id]).flatMap((group) => group.items
      .flatMap((item) => { const hit = match(item); return hit ? [{ group, item: hit }] : []; }));
    const starts = runStarts(hits.map((h) => h.group.key));
    const found: ReferenceGroup[] = [];
    hits.forEach(({ group, item }, i) => {
      if (starts[i]) found.push({ key: `${tab.id}:${group.key}`, title: group.title ?? tab.label, look: group.look, items: [] });
      found[found.length - 1].items.push(item);
    });
    return found;
  });
}
