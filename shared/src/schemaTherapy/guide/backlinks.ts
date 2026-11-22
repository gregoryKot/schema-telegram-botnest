// Обратная сторона связей на листах справочника: id — из kb/links.ts (правило базы знаний, раздел 2),
// здесь только названия. Цикл импорта с ./index безопасен: функции зовутся при открытии листа.
import { getModeById, getSchemaById } from '../schemaTherapyData';
import {
  schemasOfMode,
  usagesOfTechnique,
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

/** Схемы, для которых режим типичен; id без схемы в реестре пропускается. */
export function modeSchemaLinks(modeId: string): GuideBacklink[] {
  return schemasOfMode(modeId).flatMap((id) => {
    const name = getSchemaById(id)?.name;
    return name ? [{ id, name }] : [];
  });
}

/** Где применяется техника, группами в порядке «режимы, схемы, запросы»; пустая группа не попадает. */
export function techniqueUsageGroups(
  tr: Tr,
  techniqueId: string,
): GuideUsageGroup[] {
  const usages = usagesOfTechnique(techniqueId);
  const concerns = new Map(buildConcernGuides(tr).map((c) => [c.id, c.name]));
  const nameOf: Record<KbUsageKind, (id: string) => string | undefined> = {
    mode: (id) => getModeById(id)?.name,
    schema: (id) => getSchemaById(id)?.name,
    concern: (id) => concerns.get(id),
  };
  return (Object.keys(USAGE_LEADS) as KbUsageKind[]).flatMap((kind) => {
    const ids = [
      ...new Set(usages.filter((u) => u.kind === kind).map((u) => u.id)),
    ];
    const items = ids.flatMap((id) => {
      const name = nameOf[kind](id);
      return name ? [{ id, name }] : [];
    });
    return items.length > 0 ? [{ kind, lead: USAGE_LEADS[kind], items }] : [];
  });
}

/** Группы одной строкой на группу: «Режимы: А, Б» — текст раздела для адреса. */
export function usageLines(groups: GuideUsageGroup[]): string[] {
  return groups.map(
    (g) => `${g.lead}: ${g.items.map((i) => i.name).join(', ')}`,
  );
}
