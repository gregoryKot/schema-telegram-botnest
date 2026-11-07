// Модель «Справочника» терапевта (#995, шаг 4): группы и строки — в порядке
// реестров режимов и доменов, без своего раздела строки нет, пустой группы
// нет; поиск — по названиям во всех разделах, без учёта регистра и «ё».
import { describe, it, expect } from 'vitest';
import { buildReference, searchReference, type ReferenceTexts } from './guideReferenceModel';
import type { ModeGuide, SchemaGuide } from '../../../../shared/src/schemaTherapy/guide';
import {
  FIXTURE_GUIDE,
  FIXTURE_SCHEMA_GUIDE,
  FIXTURE_TECHNIQUES,
} from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;
const mode = (modeId: string): ModeGuide => ({ ...FIXTURE_GUIDE, modeId });
const schema = (schemaId: string): SchemaGuide => ({ ...FIXTURE_SCHEMA_GUIDE, schemaId });

function texts(over: Partial<ReferenceTexts> = {}): ReferenceTexts {
  return {
    // порядок разделов в тексте не задаёт порядок строк: он — из реестров
    buildModeGuides: () => [mode('healthy_adult'), mode('angry_child'), mode('vulnerable_child')],
    buildSchemaDomainGuides: () => [
      { domainId: 'autonomy', note: '', schemas: [schema('failure')] },
      { domainId: 'rejection', note: '', schemas: [schema('mistrust'), schema('abandonment')] },
    ],
    buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
    practiceNotes: () => [{ id: 'group_format', title: 'Групповой формат', paragraphs: ['Абзац'], sources: '[Фаррелл]' }],
    ...over,
  };
}

describe('buildReference', () => {
  it('режимы — по группам реестра, в его порядке; группы без разделов нет', () => {
    const { modes } = buildReference(texts(), tr);
    expect(modes.map((g) => g.title)).toEqual(['Детские режимы', 'Здоровые режимы']);
    expect(modes[0].items.map((i) => i.id)).toEqual(['vulnerable_child', 'angry_child']);
    expect(modes[0].items[0]).toEqual({ kind: 'mode', id: 'vulnerable_child', name: 'Уязвимый Ребёнок' });
  });

  it('схемы — по доменам реестра, в его порядке, с названиями из реестра', () => {
    const { schemas } = buildReference(texts(), tr);
    expect(schemas.map((g) => g.key)).toEqual(['rejection', 'autonomy']);
    expect(schemas[0].title).toBe('Нарушение связи и отвержение');
    expect(schemas[0].items.map((i) => i.id)).toEqual(['abandonment', 'mistrust']);
    expect(schemas[0].items[0].name).toBe('Покинутость / Нестабильность');
  });

  it('техники — с описанием строкой ниже; «Для терапевта» — заголовки разделов', () => {
    const { techniques, practice } = buildReference(texts(), tr);
    expect(techniques[0].title).toBeUndefined();
    expect(techniques[0].items[0]).toEqual({
      kind: 'technique', id: 'imagery_rescripting', name: 'Рескриптинг образов', sub: FIXTURE_TECHNIQUES[0].summary,
    });
    expect(practice[0].items).toEqual([{ kind: 'note', id: 'group_format', name: 'Групповой формат' }]);
  });

  it('раздел без текстов — пустой список, а не группа без строк', () => {
    expect(buildReference(texts({ practiceNotes: () => [] }), tr).practice).toEqual([]);
  });
});

describe('searchReference', () => {
  const ref = buildReference(texts(), tr);

  it('пустой запрос — ничего: экран показывает выбранный раздел', () => {
    expect(searchReference(ref, '   ')).toEqual([]);
  });

  it('совпадения из всех разделов, группа — имя раздела; регистр и «ё» не важны', () => {
    const found = searchReference(ref, 'РЕБЕНОК');
    expect(found.map((g) => g.title)).toEqual(['Режимы']);
    expect(found[0].items.map((i) => i.id)).toEqual(['vulnerable_child', 'angry_child']);
    const mixed = searchReference(ref, 'ов');
    expect(mixed.map((g) => g.title)).toEqual(['Режимы', 'Схемы', 'Техники', 'Для терапевта']);
    expect(mixed.flatMap((g) => g.items.map((i) => i.name))).toEqual([
      'Здоровый Взрослый', 'Недоверие / Ожидание жестокого обращения', 'Рескриптинг образов', 'Групповой формат',
    ]);
  });

  it('ничего не нашлось — пустой список', () => {
    expect(searchReference(ref, 'щщщ')).toEqual([]);
  });
});
