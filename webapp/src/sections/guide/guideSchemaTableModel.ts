// «Справочник» терапевта, «Схемы» → «Таблицей»: все схемы рядом — короткое описание из реестра
// (schemaDomains.ts, desc) и три стиля копинга из листа схемы (guide/schemas/*). Домены, их вид и
// порядок строк — те же, что у списка «Схем» (buildReference): таблица — другой вид того же раздела.
import type { SchemaCoping, SchemaDomainGuide } from '../../../../shared/src/schemaTherapy/guide';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';

/** Колонки копингов: порядок и подписи — как в листе схемы. */
export const COPING_COLUMNS: { key: keyof SchemaCoping; label: string }[] = [
  { key: 'surrender', label: 'Капитуляция' },
  { key: 'avoidance', label: 'Избегание' },
  { key: 'overcompensation', label: 'Гиперкомпенсация' },
];

export interface SchemaTableRow {
  /** Строка списка «Схем»: по ней таблица открывает лист схемы. */
  item: ReferenceItem;
  desc: string;
  coping: SchemaCoping;
}

export type SchemaTableGroup = Pick<ReferenceGroup, 'key' | 'title' | 'look'> & { rows: SchemaTableRow[] };

const DESC = new Map(SCHEMA_DOMAINS.flatMap((d) => d.schemas.map((s) => [s.id, s.desc] as const)));

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
        return c ? [{ item, desc: DESC.get(item.id) ?? '', coping: c }] : [];
      }),
    }))
    .filter((g) => g.rows.length > 0);
}
