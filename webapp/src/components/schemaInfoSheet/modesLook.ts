// Вид групп и режимов справочника (редизайн 2026-11, docs/design/APP_2026-11.md, b16): бумага группы
// MODE_GROUP_HUE и знак группы — тем же языком, что у «Справочника» терапевта и дневника режимов
// (ModeGroupList), а не цветные точки. Группа «Дисфункциональные копинги» справочника собирает три
// стиля копинга (капитуляция, избегание, гиперкомпенсация) — у неё три знака: Yield, Shelter, Shield;
// один знак назвал бы все копинги капитуляцией. Чек-ин: режим берёт знак группы или свой
// («Сердитый Ребёнок» — Flare, решение 6) через modeLook — тот же вид, что в «Мне плохо».
import { modeGroupLook, modeLook, type ModeLook, type ModeSignKey, type PaperHue } from '../../../../shared/src/theme/entityLook';

/** Группа справочника: ключ группы MODE_GROUP_HUE и, у смешанной группы, свой ключ строки (`look`). */
interface LibraryGroup {
  look: string;
  items: readonly object[];
}

const itemLook = (m: object, group: string): string => ('look' in m && typeof m.look === 'string' ? m.look : group);

/** Бумага группы и её знаки по порядку строк, без повторов. */
export function libraryGroupLook(group: LibraryGroup): { hue: PaperHue; signs: ModeSignKey[] } {
  const signs = group.items.map((m) => modeGroupLook(itemLook(m, group.look)).sign);
  return { hue: modeGroupLook(group.look).hue, signs: [...new Set(signs)] };
}

/** Вид плитки чек-ина: бумага группы режима и его знак. */
export function checkinLook(item: { group: string; modeId?: string }): ModeLook {
  return modeLook(item.modeId ?? '', item.group);
}
