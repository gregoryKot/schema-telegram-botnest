import type { SchemaDomain, ModeGroup } from '../../schemaTherapyData';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';
import { ENTITY_LOOK, domainLook, modeGroupLook, type SheetLook } from '../../../../shared/src/theme/entityLook';
import type { WeekPatternKind } from '../../../../shared/src/pattern/patternsSummary';

export interface MineGroup { id: string; title: string; hue: number | undefined; ids: string[] }

interface Source { id: string; title: string; hue: number | undefined; memberIds: string[] }

/**
 * Общая механика «Мои схемы / Мои режимы» списком (телефон): группы в порядке данных,
 * внутри — порядок профиля. Пустые группы, неизвестные id и повторы отбрасываются.
 */
function groupMine(sources: Source[], ids: string[]): MineGroup[] {
  return sources.flatMap(s => {
    const own = ids.filter(id => s.memberIds.includes(id));
    return own.length ? [{ id: s.id, title: s.title, hue: s.hue, ids: [...new Set(own)] }] : [];
  });
}

export function groupMineByDomain(domains: SchemaDomain[], ids: string[]): MineGroup[] {
  return groupMine(domains.map(d => ({ id: d.id, title: d.domain, hue: DOMAIN_HUE[d.id], memberIds: d.schemas.map(s => s.id) })), ids);
}

export function groupMineByModeGroup(groups: ModeGroup[], ids: string[]): MineGroup[] {
  return groupMine(groups.map(g => ({ id: g.id, title: g.group, hue: MODE_GROUP_HUE[g.id], memberIds: g.items.map(m => m.id) })), ids);
}

/** Вид группы: схема — бумага и знак домена, режим — бумага и знак группы режимов (MineGroupsList, сверка героя). */
export const mineGroupLook = (kind: WeekPatternKind, id: string): SheetLook =>
  kind === 'schema' ? domainLook(id) ?? ENTITY_LOOK.schemas : modeGroupLook(id);
