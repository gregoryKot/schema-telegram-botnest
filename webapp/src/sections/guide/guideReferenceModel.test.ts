// Модель «Справочника» терапевта (#995, шаг 4): группы и строки — в порядке
// реестров режимов и доменов, без своего раздела строки нет, пустой группы
// нет; у группы — бумага и знак (как у клиента), у строки — знак её листа;
// поиск — по названиям во всех разделах, без учёта регистра и «ё», найденное
// лежит на листе своей группы — знак группы один раз на серию.
import { describe, it, expect } from 'vitest';
import { buildReference, referenceLayout, type ReferenceTexts } from './guideReferenceModel';
import { searchReference } from './guideReferenceSearch';
import type { ModeGuide, SchemaGuide } from '../../../../shared/src/schemaTherapy/guide';
import {
  FIXTURE_GUIDE,
  FIXTURE_PRACTICE_NOTE,
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
    practiceNotes: () => [FIXTURE_PRACTICE_NOTE, { ...FIXTURE_PRACTICE_NOTE, id: 'свой_раздел', title: 'Свой раздел' }],
    ...over,
  };
}

describe('buildReference', () => {
  it('режимы — по группам реестра, в его порядке; группы без разделов нет', () => {
    const { modes } = buildReference(texts(), tr);
    expect(modes.map((g) => g.title)).toEqual(['Детские режимы', 'Здоровые режимы']);
    expect(modes[0].items.map((i) => i.id)).toEqual(['vulnerable_child', 'angry_child']);
    expect(modes[0].items[0]).toEqual({
      kind: 'mode', id: 'vulnerable_child', name: 'Уязвимый Ребёнок', sign: 'child_care',
    });
    expect(modes[0].items[1].sign).toBe('flare');
    expect(modes.map((g) => g.look)).toEqual([{ hue: 28, sign: 'child_care' }, { hue: 145, sign: 'together' }]);
  });

  it('схемы — по доменам реестра, в его порядке, с названиями из реестра', () => {
    const { schemas } = buildReference(texts(), tr);
    expect(schemas.map((g) => g.key)).toEqual(['rejection', 'autonomy']);
    expect(schemas[0].title).toBe('Нарушение связи и отвержение');
    expect(schemas[0].items.map((i) => i.id)).toEqual(['abandonment', 'mistrust']);
    expect(schemas[0].items[0].name).toBe('Покинутость / Нестабильность');
    expect(schemas.map((g) => g.look)).toEqual([{ hue: 28, sign: 'domain_rejection' }, { hue: 70, sign: 'domain_autonomy' }]);
    expect(schemas[1].items[0].sign).toBe('domain_autonomy');
  });

  it('техники и «Для терапевта» — с сутью строкой ниже и своим знаком; раздел без знака — без картинки', () => {
    const { techniques, practice } = buildReference(texts(), tr);
    expect(techniques[0].title).toBeUndefined();
    expect(techniques[0].items[0]).toEqual({
      kind: 'technique', id: 'imagery_rescripting', name: 'Рескриптинг образов', sub: FIXTURE_TECHNIQUES[0].summary,
      sign: 'rescript',
    });
    expect(practice[0].items).toEqual([
      { kind: 'note', id: 'group_therapy', name: 'Групповой формат', sub: FIXTURE_PRACTICE_NOTE.summary, sign: 'cluster' },
      { kind: 'note', id: 'свой_раздел', name: 'Свой раздел', sub: FIXTURE_PRACTICE_NOTE.summary, sign: undefined },
    ]);
    // у листа техник и «Для терапевта» знака нет — он у каждой строки свой
    expect([techniques[0].look, practice[0].look]).toEqual([{ hue: 45 }, { hue: 240 }
    ]);
  });

  it('раздел без текстов — пустой список, а не группа без строк', () => {
    expect(buildReference(texts({ practiceNotes: () => [] }), tr).practice).toEqual([]);
  });
});

describe('referenceLayout', () => {
  it('режимы и схемы — группами, техники и «Для терапевта» — карточками, поиск — строками', () => {
    expect(referenceLayout('modes', false)).toBe('groups');
    expect(referenceLayout('schemas', false)).toBe('groups');
    expect(referenceLayout('techniques', false)).toBe('tiles');
    expect(referenceLayout('practice', false)).toBe('tiles');
    expect(referenceLayout('modes', true)).toBe('rows');
    expect(referenceLayout('practice', true)).toBe('rows');
  });
});

describe('searchReference', () => {
  const ref = buildReference(texts(), tr);

  it('пустой запрос — ничего: экран показывает выбранный раздел', () => {
    expect(searchReference(ref, '   ')).toEqual([]);
  });

  it('совпадения из всех разделов; регистр и «ё» не важны; у техник и «Для терапевта» лист — имя раздела', () => {
    const found = searchReference(ref, 'РЕБЕНОК');
    expect(found.map((g) => g.title)).toEqual(['Детские режимы']);
    expect(found[0].items.map((i) => i.id)).toEqual(['vulnerable_child', 'angry_child']);
    const mixed = searchReference(ref, 'ов');
    expect(mixed.map((g) => g.title)).toEqual(['Здоровые режимы', 'Нарушение связи и отвержение', 'Техники', 'Для терапевта']);
    expect(mixed.map((g) => g.key)).toEqual(['modes:healthy', 'schemas:rejection', 'techniques:techniques', 'practice:practice']);
    expect(mixed.flatMap((g) => g.items.map((i) => i.name))).toEqual([
      'Здоровый Взрослый', 'Недоверие / Ожидание жестокого обращения', 'Рескриптинг образов', 'Групповой формат',
    ]);
  });

  it('серия одной группы — один лист: знак группы у подписи один раз, а не у каждой строки', () => {
    const critics = buildReference(texts({
      buildModeGuides: () => [mode('punitive_critic'), mode('demanding_critic'), mode('guilt_critic'), mode('vulnerable_child')],
    }), tr);
    const found = searchReference(critics, 'крит');
    expect(found).toHaveLength(1);
    expect(found[0].look).toEqual({ hue: 310, sign: 'looming' });
    expect(found[0].items.map((i) => i.id)).toEqual(['demanding_critic', 'punitive_critic', 'guilt_critic']);
    expect(found[0].items.every((i) => i.kind === 'mode')).toBe(true);
  });

  it('совпадения из разных групп — по листу на группу, в порядке реестра, бумага у каждой своя', () => {
    const found = searchReference(ref, 'ый');
    const modes = found.filter((g) => g.key.startsWith('modes:'));
    expect(modes.map((g) => g.key)).toEqual(['modes:child', 'modes:healthy']);
    expect(modes.map((g) => g.look.hue)).toEqual([28, 145]);
    expect(new Set(found.map((g) => g.key)).size).toBe(found.length);
  });

  it('ничего не нашлось — пустой список', () => {
    expect(searchReference(ref, 'щщщ')).toEqual([]);
  });
});

// Ревью вкуса r1: три листа копингов одного неба 240 стояли соседями — сплошное голубое поле.
// Теперь лист один, подгрупп три: подписи, знаки и порядок строк — прежние.
describe('копинги — один лист с тремя подгруппами', () => {
  const coping = buildReference(texts({
    buildModeGuides: () => [
      mode('vulnerable_child'), mode('compliant_surrenderer'), mode('detached_protector'), mode('angry_protector'),
      mode('overcontroller'), mode('self_aggrandiser'), mode('healthy_adult'),
    ],
  }), tr);

  it('три группы копингов сведены в один лист неба без общей подписи и знака; соседние группы — как были', () => {
    expect(coping.modes.map((g) => g.key)).toEqual(['child', 'coping', 'healthy']);
    const sheet = coping.modes[1];
    expect(sheet.title).toBeUndefined();
    expect(sheet.look).toEqual({ hue: 240 });
    expect(coping.modes[0].parts).toBeUndefined();
  });

  it('у подгруппы — прежняя подпись группы и её знак; строки в порядке реестра, общий список — те же строки подряд', () => {
    const sheet = coping.modes[1];
    expect(sheet.parts!.map((p) => [p.title, p.look.sign])).toEqual([
      ['Копинг: Капитуляция', 'yield'], ['Копинг: Избегание', 'shelter'], ['Копинг: Гиперкомпенсация', 'shield'],
    ]);
    expect(sheet.parts!.map((p) => p.items.map((i) => i.id))).toEqual([
      ['compliant_surrenderer'], ['detached_protector', 'angry_protector'], ['self_aggrandiser', 'overcontroller'],
    ]);
    expect(sheet.items).toEqual(sheet.parts!.flatMap((p) => p.items));
  });

  it('копинг одного стиля — тоже лист с подгруппой (подпись стиля не теряется); без копингов листа нет', () => {
    const one = buildReference(texts({ buildModeGuides: () => [mode('detached_protector')] }), tr).modes;
    expect(one.map((g) => g.key)).toEqual(['coping']);
    expect(one[0].parts!.map((p) => p.title)).toEqual(['Копинг: Избегание']);
    expect(buildReference(texts(), tr).modes.some((g) => g.parts)).toBe(false);
  });

  it('поиск: найденный копинг остаётся на листе с подписью и знаком своей подгруппы', () => {
    const found = searchReference(coping, 'защитник');
    expect(found.map((g) => [g.key, g.title, g.look.sign, g.look.hue])).toEqual([['modes:coping_avoidance', 'Копинг: Избегание', 'shelter', 240]]);
    expect(found[0].items.map((i) => i.id)).toEqual(['detached_protector', 'angry_protector']);
    expect(found[0].parts).toBeUndefined();
  });
});
