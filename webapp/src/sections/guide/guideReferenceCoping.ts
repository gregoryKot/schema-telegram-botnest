// «Справочник» терапевта, вкладка «Режимы»: три стиля копинга — одна бумага (небо 240). Три листа
// одного оттенка подряд сливались в сплошное голубое поле (на телефоне ~1100px). У клиента (b16) это
// один лист с тремя знаками; здесь — один лист с тремя подгруппами: подпись и знак у каждой свои
// (Yield, Shelter, Shield), строки — в том же порядке.
import type { ReferenceGroup } from './guideReferenceModel';

const isCoping = (g: ReferenceGroup) => g.key.startsWith('coping_');

/** Идущие подряд группы копингов → один лист их бумаги с подгруппами; остальные группы — как были. */
export function mergeCoping(groups: ReferenceGroup[]): ReferenceGroup[] {
  const out: ReferenceGroup[] = [];
  let sheet: ReferenceGroup | null = null;
  for (const g of groups) {
    if (!isCoping(g) || g.title === undefined) { sheet = null; out.push(g); continue; }
    const part = { key: g.key, title: g.title, look: g.look, items: g.items };
    if (sheet?.parts) {
      sheet.parts.push(part);
      sheet.items.push(...g.items);
    } else {
      sheet = { key: 'coping', look: { hue: g.look.hue }, items: [...g.items], parts: [part] };
      out.push(sheet);
    }
  }
  return out;
}

/** Листья для поиска: подгруппа листа — сама себе группа (найденное остаётся под подписью своей подгруппы). */
export const leafGroups = (groups: ReferenceGroup[]): ReferenceGroup[] => groups.flatMap((g) => g.parts ?? [g]);
