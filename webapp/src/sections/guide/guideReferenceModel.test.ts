// Модель «Справочника» терапевта (#995, шаг 4): группы и строки — в порядке
// реестров режимов и доменов, без своего раздела строки нет, пустой группы
// нет; у группы — бумага и знак (как у клиента), у строки — знак её листа;
// поиск — по названиям во всех разделах, без учёта регистра и «ё», найденное
// лежит на листе своей группы — знак группы один раз на серию.
import { describe, it, expect } from 'vitest';
import { REFERENCE_TABS, buildReference, referenceLayout, type ReferenceTexts } from './guideReferenceModel';
import { CONCERNS_HINT, CONCERNS_TITLE } from './guideReferenceConcerns';
import { PHASES_HINT, PHASES_TITLE } from './guideReferencePhases';
import { searchReference } from './guideReferenceSearch';
import type { ConcernGuide, ModeGuide, PhaseGuide, SchemaGuide } from '../../../../shared/src/schemaTherapy/guide';
import {
  FIXTURE_GUIDE,
  FIXTURE_PRACTICE_NOTE,
  FIXTURE_SCHEMA_GUIDE,
  FIXTURE_TECHNIQUES,
} from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;
const mode = (modeId: string): ModeGuide => ({ ...FIXTURE_GUIDE, modeId });
const schema = (schemaId: string): SchemaGuide => ({ ...FIXTURE_SCHEMA_GUIDE, schemaId });
const CONCERN: ConcernGuide = { id: 'bpd', name: 'Пограничное расстройство', goal: 'Вырастить Здорового Взрослого', essence: 'Нестабильность', sources: '' };
const PHASE: PhaseGuide = { id: 'overview', name: 'Как устроен путь', goal: 'Карта, а не расписание', essence: 'Фазы условные', sources: '' };

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
    buildConcernGuides: () => [CONCERN, { ...CONCERN, id: 'свой_запрос', name: 'Свой запрос' }],
    buildPhaseGuides: () => [PHASE, { ...PHASE, id: 'bonding', name: 'Связь' }, { ...PHASE, id: 'change', name: 'Изменение' }],
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
    expect(techniques.map((g) => g.title)).toEqual(['Эмпирические']); // пустые группы отсеяны
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
    expect(buildReference(texts({ buildConcernGuides: () => [] }), tr).concerns).toEqual([]);
  });

  it('«Запросы» — одна группа с подписью «что это и зачем», строки с целью и своим знаком на бирюзе', () => {
    const [group, ...rest] = buildReference(texts(), tr).concerns;
    expect(rest).toEqual([]);
    expect(group).toMatchObject({ title: CONCERNS_TITLE, hint: CONCERNS_HINT, look: { hue: 195 } });
    expect(group.items).toEqual([
      { kind: 'concern', id: 'bpd', name: 'Пограничное расстройство', sub: 'Вырастить Здорового Взрослого', sign: 'ribbon' },
      { kind: 'concern', id: 'свой_запрос', name: 'Свой запрос', sub: 'Вырастить Здорового Взрослого', sign: undefined },
    ]);
  });

  it('«Путь терапии» — одна раскрытая группа с подписью «что это и зачем»: обзор без номера, фазы — по порядку с номерами', () => {
    const [group, ...rest] = buildReference(texts(), tr).path;
    expect(rest).toEqual([]);
    expect(group).toMatchObject({ title: PHASES_TITLE, hint: PHASES_HINT, look: { hue: 290 } });
    expect(group.fold).toBeUndefined();
    expect(group.items).toEqual([
      { kind: 'phase', id: 'overview', name: 'Как устроен путь', sub: 'Карта, а не расписание', step: undefined, sign: 'path_overview', hue: 290 },
      { kind: 'phase', id: 'bonding', name: 'Связь', sub: 'Карта, а не расписание', step: 1, hue: 290 }, // лист без своего вида — сирень без знака
      { kind: 'phase', id: 'change', name: 'Изменение', sub: 'Карта, а не расписание', step: 2, hue: 290 },
    ]);
    expect(buildReference(texts({ buildPhaseGuides: () => [] }), tr).path).toEqual([]);
  });

  it('вкладки «Запросы» и «Путь терапии» стоят между «Техниками» и «Для терапевта»', () => {
    const ids = REFERENCE_TABS.map((t) => t.id);
    expect(ids.slice(ids.indexOf('techniques'))).toEqual(['techniques', 'concerns', 'path', 'practice']);
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

  it('совпадения из всех разделов; регистр и «ё» не важны; у техник и «Для терапевта» лист — их группа', () => {
    const found = searchReference(ref, 'РЕБЕНОК');
    expect(found.map((g) => g.title)).toEqual(['Детские режимы']);
    expect(found[0].items.map((i) => i.id)).toEqual(['vulnerable_child', 'angry_child']);
    const mixed = searchReference(ref, 'ов');
    expect(mixed.map((g) => g.title)).toEqual(['Здоровые режимы', 'Нарушение связи и отвержение', 'Эмпирические', 'Терапевт и формат']);
    expect(mixed.map((g) => g.key)).toEqual(['modes:healthy', 'schemas:rejection', 'techniques:experiential', 'practice:therapist']);
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
