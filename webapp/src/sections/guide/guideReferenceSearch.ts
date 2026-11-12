import { runStarts } from '../../../../shared/src/utils/runStarts';
import { matchesSearch } from '../../../../shared/src/utils/searchNormalize';
import { REFERENCE_TABS, type Reference, type ReferenceGroup } from './guideReferenceModel';
import { leafGroups } from './guideReferenceCoping';

/**
 * Поиск «Справочника» терапевта по названиям во всех разделах (модель — guideReferenceModel.ts). Найденное остаётся на листе своей группы: строки одной группы
 * режимов или одного домена идут серией — у серии один лист со знаком у подписи, строки знак не
 * повторяют (три Критика подряд — один знак, а не три; та же «серия», что у плиток чек-ина клиента,
 * runStarts). У техник и «Для терапевта» групп нет: один лист на раздел, подпись — имя раздела, знак у
 * строки свой. Регистр и «ё/е» не различаются (matchesSearch). Пустой запрос — пустой список: экран
 * тогда показывает выбранный раздел. Подгруппа листа (копинг) ищется как своя группа — leafGroups.
 */
export function searchReference(ref: Reference, query: string): ReferenceGroup[] {
  if (!query.trim()) return [];
  return REFERENCE_TABS.flatMap((tab) => {
    const hits = leafGroups(ref[tab.id]).flatMap((group) => group.items
      .filter((item) => matchesSearch(item.name, query))
      .map((item) => ({ group, item })));
    const starts = runStarts(hits.map((h) => h.group.key));
    const found: ReferenceGroup[] = [];
    hits.forEach(({ group, item }, i) => {
      if (starts[i]) found.push({ key: `${tab.id}:${group.key}`, title: group.title ?? tab.label, look: group.look, items: [] });
      found[found.length - 1].items.push(item);
    });
    return found;
  });
}
