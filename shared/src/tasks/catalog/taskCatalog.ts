// Каталог текстовых заданий «Из справочника» (лист «Новое задание»): задания без экрана в
// приложении. Своих текстов здесь нет — всё собрано из пунктов «Между сессиями» режимов и схем
// справочника терапевта; при каких режимах и схемах давать, выводится из тех же данных.
// Только типы: тексты справочника — отдельный чанк (см. guideLoader); статический импорт вернул бы их
// в чанк листа «Новое задание», который тянет и guideAssign.
import type { BetweenSessionsItem } from '../../schemaTherapy/guide';
import type { Guide } from '../../therapy/conceptGraph/guideLoader';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import {
  matchesSearch,
  normalizeSearchText,
} from '../../utils/searchNormalize';

type Tr = Parameters<Guide['buildModeGuides']>[0];
export type CatalogGroupId = 'modes' | 'schemas';

export interface CatalogTask {
  /** Стабильный id из названия. */
  id: string;
  title: string;
  /** «Что делать». */
  text: string;
  /** id режимов и схем, в чьём «Между сессиями» задание стоит. */
  forModes: string[];
  forSchemas: string[];
  /** Задание хотя бы одного режима — «При режимах», только схем — «При схемах». */
  group: CatalogGroupId;
}
export interface CatalogGroup {
  id: CatalogGroupId;
  title: string;
  items: CatalogTask[];
}

const GROUP_TITLES: Record<CatalogGroupId, string> = {
  modes: 'При режимах',
  schemas: 'При схемах',
};

/** Текст «Своего задания» из пункта справочника: название первой строкой, ниже инструкция. */
export function customTaskText(item: { title: string; text: string }): string {
  return `${item.title}\n${item.text}`;
}

/** Название без регистра, «ё» и знаков — по нему склеиваются повторы и строится id. */
export function catalogTaskId(title: string): string {
  return normalizeSearchText(title)
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim()
    .replace(/ /g, '-');
}

interface Source {
  betweenSessions: BetweenSessionsItem[];
}

/** Пункты `custom` режимов и схем одной записью на название; текст — первого встреченного. */
export function collectTaskCatalog(
  modes: (Source & { modeId: string })[],
  schemas: (Source & { schemaId: string })[],
): CatalogTask[] {
  const byId = new Map<string, CatalogTask>();
  const add = (
    source: Source,
    field: 'forModes' | 'forSchemas',
    ownerId: string,
  ) => {
    for (const item of source.betweenSessions) {
      if (item.kind !== 'custom') continue;
      const id = catalogTaskId(item.title);
      const task = byId.get(id) ?? {
        id,
        title: item.title,
        text: item.text,
        forModes: [],
        forSchemas: [],
        group: 'schemas',
      };
      if (!task[field].includes(ownerId)) task[field].push(ownerId);
      if (field === 'forModes') task.group = 'modes';
      byId.set(id, task);
    }
  };
  modes.forEach((m) => add(m, 'forModes', m.modeId));
  schemas.forEach((s) => add(s, 'forSchemas', s.schemaId));
  return [...byId.values()];
}

export function buildTaskCatalog(
  guide: Pick<Guide, 'buildModeGuides' | 'buildSchemaGuides'>,
  tr: Tr,
): CatalogTask[] {
  return collectTaskCatalog(guide.buildModeGuides(tr), guide.buildSchemaGuides(tr));
}

/** Записи, чьё название содержит запрос, по группам; пустые группы не показываются. */
export function searchTaskCatalog(
  tasks: CatalogTask[],
  query: string,
): CatalogGroup[] {
  const found = tasks.filter((t) => matchesSearch(t.title, query));
  return (['modes', 'schemas'] as const)
    .map((id) => ({
      id,
      title: GROUP_TITLES[id],
      items: found.filter((t) => t.group === id),
    }))
    .filter((g) => g.items.length > 0);
}

/** «Когда давать»: названия режимов и схем из общих каталогов. */
export function catalogTaskWhen(task: CatalogTask): string[] {
  const names = [
    ...task.forModes.map((id) => getModeById(id)?.name),
    ...task.forSchemas.map((id) => getSchemaById(id)?.name),
  ];
  return names.filter((n): n is string => Boolean(n));
}
