// Таблица схем «Справочника»: домены и строки — те же, что у списка «Схем», к строке — описание из
// реестра и копинг её листа; схемы без листа и пустого домена в таблице нет.
import { describe, it, expect } from 'vitest';
import { buildReference } from './guideReferenceModel';
import { buildSchemaTable, cellKey, showsFull, toggleCell, visibleStyles } from './guideSchemaTableModel';
import type { SchemaDomainGuide, SchemaGuide } from '../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_SCHEMA_GUIDE } from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;
const schema = (schemaId: string): SchemaGuide => ({
  ...FIXTURE_SCHEMA_GUIDE,
  schemaId,
  coping: { surrender: `${schemaId}: сдаётся`, avoidance: `${schemaId}: избегает`, overcompensation: `${schemaId}: наоборот` },
});
const GUIDES: SchemaDomainGuide[] = [
  { domainId: 'autonomy', note: '', schemas: [schema('failure')] },
  { domainId: 'rejection', note: '', schemas: [schema('mistrust'), schema('abandonment')] },
];
const groups = (guides: SchemaDomainGuide[]) => buildReference({
  buildModeGuides: () => [], buildTechniqueGuides: () => [], practiceNotes: () => [], buildConcernGuides: () => [], buildPhaseGuides: () => [],
  buildSchemaDomainGuides: () => guides,
}, tr).schemas;

describe('buildSchemaTable', () => {
  it('домены и порядок строк — как у списка «Схем»; к строке — описание реестра и копинг листа', () => {
    const table = buildSchemaTable(groups(GUIDES), GUIDES);
    expect(table.map((g) => g.title)).toEqual(['Нарушение связи и отвержение', 'Нарушенная автономия']);
    expect(table[0].rows.map((r) => r.item.id)).toEqual(['abandonment', 'mistrust']);
    expect(table[0].rows[0]).toMatchObject({
      item: { kind: 'schema', id: 'abandonment', name: 'Покинутость / Нестабильность' },
      desc: 'Страх, что близкие бросят или окажутся ненадёжными',
      coping: { surrender: 'abandonment: сдаётся', avoidance: 'abandonment: избегает', overcompensation: 'abandonment: наоборот' },
    });
    expect(table[0].look).toEqual(groups(GUIDES)[0].look);
  });

  it('схемы без копинга в листе нет; домен без строк не показывается', () => {
    const table = buildSchemaTable(groups(GUIDES), [GUIDES[1]]);
    expect(table.map((g) => g.key)).toEqual(['rejection']);
  });

  it('к строке — выжимки копинга схемы', () => {
    const [row] = buildSchemaTable(groups(GUIDES), GUIDES)[0].rows;
    expect(row.headline).toEqual({ surrender: 'Держится за ненадёжных', avoidance: 'Уходит первым', overcompensation: 'Цепляется и ревнует' });
  });
});

describe('вид таблицы', () => {
  it('«Все три» — три колонки в порядке листа, один стиль — одна колонка', () => {
    expect(visibleStyles('all').map((s) => s.id)).toEqual(['surrender', 'avoidance', 'overcompensation']);
    expect(visibleStyles('avoidance').map((s) => s.id)).toEqual(['avoidance']);
  });

  it('тап раскрывает клетку, повторный сворачивает, другая клетка сменяет раскрытую', () => {
    const a = cellKey('failure', 'surrender');
    const b = cellKey('failure', 'avoidance');
    expect(toggleCell(null, a)).toBe(a);
    expect(toggleCell(a, a)).toBeNull();
    expect(toggleCell(a, b)).toBe(b);
  });

  it('полный текст — в «Подробно», у раскрытой клетки и у клетки без выжимки', () => {
    const k = cellKey('failure', 'surrender');
    expect(showsFull('short', null, k, 'Делает вполсилы')).toBe(false);
    expect(showsFull('full', null, k, 'Делает вполсилы')).toBe(true);
    expect(showsFull('short', k, k, 'Делает вполсилы')).toBe(true);
    expect(showsFull('short', null, k, undefined)).toBe(true);
  });
});
