// «Справочник» терапевта, «Схемы» → «Таблицей»: все схемы рядом — короткое описание из реестра
// (schemaDomains.ts, desc), три стиля копинга из листа схемы (guide/schemas/*) и их выжимки
// (copingHeadlines.ts). Домены, их вид и порядок строк — те же, что у списка «Схем» (buildReference).
import type { SchemaCoping, SchemaDomainGuide } from '../../../../shared/src/schemaTherapy/guide';
import { COPING_STYLES, type CopingStyle, type CopingStyleId } from '../../../../shared/src/schemaTherapy/guide/copingStyles';
import { SCHEMA_COPING_HEADLINES } from '../../../../shared/src/schemaTherapy/guide/schemas/copingHeadlines';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';

export interface SchemaTableRow {
  /** Строка списка «Схем»: по ней таблица открывает лист схемы. */
  item: ReferenceItem;
  desc: string;
  coping: SchemaCoping;
  /** Выжимка 2–4 слова на стиль; нет выжимки — клетка показывает только полный текст. */
  headline: Partial<SchemaCoping>;
}

export type SchemaTableGroup = Pick<ReferenceGroup, 'key' | 'title' | 'look'> & { rows: SchemaTableRow[] };

const DESC = new Map(SCHEMA_DOMAINS.flatMap((d) => d.schemas.map((s) => [s.id, s.desc] as const)));
const HEADLINES: Map<string, SchemaCoping> = new Map(Object.entries(SCHEMA_COPING_HEADLINES));

/** Группы списка «Схем» → таблица; схема без копинга в листе в таблицу не попадает, пустой домен — тоже. */
export function buildSchemaTable(groups: ReferenceGroup[], guides: SchemaDomainGuide[]): SchemaTableGroup[] {
  const coping = new Map(guides.flatMap((d) => d.schemas.map((s) => [s.schemaId, s.coping] as const)));
  return groups
    .map((g) => ({
      key: g.key,
      title: g.title,
      look: g.look,
      rows: g.items.flatMap((item) => {
        const c = item.kind === 'schema' ? coping.get(item.id) : undefined;
        return c ? [{ item, desc: DESC.get(item.id) ?? '', coping: c, headline: HEADLINES.get(item.id) ?? {} }] : [];
      }),
    }))
    .filter((g) => g.rows.length > 0);
}

/** Фильтр стиля в шапке: все три колонки или одна. */
export type CopingFilter = 'all' | CopingStyleId;
/** Глубина: «Коротко» — выжимки, «Подробно» — полные тексты во всех клетках. */
export type TableDepth = 'short' | 'full';

/** Колонки таблицы под фильтр: «Все три» — три стиля в порядке листа, иначе один. */
export function visibleStyles(filter: CopingFilter): readonly CopingStyle[] {
  return filter === 'all' ? COPING_STYLES : COPING_STYLES.filter((s) => s.id === filter);
}

/** Ключ клетки: схема + стиль. */
export const cellKey = (schemaId: string, style: CopingStyleId) => `${schemaId}:${style}`;

/** Тап по клетке: раскрыть её (одна раскрытая за раз) или свернуть повторным тапом. */
export function toggleCell(open: string | null, key: string): string | null {
  return open === key ? null : key;
}

/** Полный текст клетки виден в «Подробно», у раскрытой клетки и у клетки без выжимки. */
export function showsFull(depth: TableDepth, open: string | null, key: string, headline: string | undefined): boolean {
  return depth === 'full' || open === key || !headline;
}
