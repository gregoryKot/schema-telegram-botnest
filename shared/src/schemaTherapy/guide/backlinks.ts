// Обратная сторона связей на листах справочника: id — из kb/links.ts (правило базы знаний, раздел 2),
// здесь только названия. Цикл импорта с ./index безопасен: функции зовутся при открытии листа.
import { getModeById, getSchemaById } from '../schemaTherapyData';
import {
  modeSchemaIndex,
  techniqueUsageIndex,
  type KbUsageKind,
} from '../kb/links';
import { buildConcernGuides } from './index';
import type { Tr } from './types';

/** Строка-переход: id и название записи. */
export interface GuideBacklink {
  id: string;
  name: string;
}

/** «Где применяется» у техники: режимы, схемы или запросы, которые её зовут. */
export interface GuideUsageGroup {
  kind: KbUsageKind;
  lead: string;
  items: GuideBacklink[];
}

const USAGE_LEADS: Record<KbUsageKind, string> = {
  mode: 'Режимы',
  schema: 'Схемы',
  concern: 'Запросы',
};

const named = (
  ids: readonly string[],
  nameOf: (id: string) => string | undefined,
) =>
  [...new Set(ids)].flatMap((id) => {
    const name = nameOf(id);
    return name ? [{ id, name }] : [];
  });

/** Режим → схемы, для которых он типичен, сразу для всех режимов; id без схемы в реестре пропускается. */
export function modeSchemaLinksAll(): Map<string, GuideBacklink[]> {
  const schemaName = (id: string) => getSchemaById(id)?.name;
  return new Map(
    [...modeSchemaIndex()].map(([m, ids]) => [m, named(ids, schemaName)]),
  );
}

export function modeSchemaLinks(modeId: string): GuideBacklink[] {
  return modeSchemaLinksAll().get(modeId) ?? [];
}

/** Техника → «Где применяется» группами «режимы, схемы, запросы», сразу для всех техник; пустых групп нет. */
export function techniqueUsageGroupsAll(
  tr: Tr,
): Map<string, GuideUsageGroup[]> {
  const concerns = new Map(buildConcernGuides(tr).map((c) => [c.id, c.name]));
  const nameOf: Record<KbUsageKind, (id: string) => string | undefined> = {
    mode: (id) => getModeById(id)?.name,
    schema: (id) => getSchemaById(id)?.name,
    concern: (id) => concerns.get(id),
  };
  const kinds = Object.keys(USAGE_LEADS) as KbUsageKind[];
  return new Map(
    [...techniqueUsageIndex()].map(([t, usages]) => [
      t,
      kinds.flatMap((kind) => {
        const ids = usages.filter((u) => u.kind === kind).map((u) => u.id);
        const items = named(ids, nameOf[kind]);
        return items.length > 0
          ? [{ kind, lead: USAGE_LEADS[kind], items }]
          : [];
      }),
    ]),
  );
}

export function techniqueUsageGroups(
  tr: Tr,
  techniqueId: string,
): GuideUsageGroup[] {
  return techniqueUsageGroupsAll(tr).get(techniqueId) ?? [];
}

/** Группы одной строкой на группу: «Режимы: А, Б» — текст раздела для адреса. */
export function usageLines(groups: GuideUsageGroup[]): string[] {
  return groups.map(
    (g) => `${g.lead}: ${g.items.map((i) => i.name).join(', ')}`,
  );
}
