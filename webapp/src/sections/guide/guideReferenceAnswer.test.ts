// Карточка-ответ «Справочника» на настоящих текстах: распознавание листа и намерения, сборка текста и связей.
import { describe, it, expect } from 'vitest';
import * as guide from '../../../../shared/src/schemaTherapy/guide';
import { buildReference } from './guideReferenceModel';
import { buildAnswerSources, findEntity, queryIntent, referenceAnswer } from './guideReferenceAnswer';

const tr = (ty: string) => ty;
const ref = buildReference(guide, tr);
const sources = buildAnswerSources(guide, tr);
const answer = (query: string) => referenceAnswer(ref, sources, query);
const schema = (id: string) => guide.buildSchemaGuides(tr).find((s) => s.schemaId === id)!;

describe('queryIntent', () => {
  it.each(['как работать со схемой покинутости', 'что делать с Карающим Критиком', 'чем помочь Уязвимому Ребёнку'])(
    '«%s» — про работу', (q) => expect(queryIntent(q)).toBe('work'),
  );
  it.each(['покинутость', 'Карающий Критик', 'что такое дефективность'])('«%s» — суть', (q) => expect(queryIntent(q)).toBe('essence'));
});

describe('findEntity', () => {
  it('схема, режим и техника — по названию в любом падеже и регистре', () => {
    expect(findEntity(ref, 'как работать со схемой покинутости')).toMatchObject({ kind: 'schema', id: 'abandonment' });
    expect(findEntity(ref, 'что делать с карающим критиком')).toMatchObject({ kind: 'mode', id: 'punitive_critic' });
    expect(findEntity(ref, 'эмпатическая конфронтация')).toMatchObject({ kind: 'technique', id: 'empathic_confrontation' });
  });
  it('точное слово сильнее начала чужого: «уязвимый ребёнок» — режим, «уязвимость» — схема', () => {
    expect(findEntity(ref, 'уязвимый ребенок')).toMatchObject({ kind: 'mode', id: 'vulnerable_child' });
    expect(findEntity(ref, 'уязвимость')).toMatchObject({ kind: 'schema', id: 'vulnerability' });
  });
  it('ничья по названиям — лидера нет', () => {
    expect(findEntity(ref, 'ребёнок')).toBeNull();
    expect(findEntity(ref, 'критик')).toBeNull();
  });
  it('названия в запросе нет или запрос из служебных слов — null', () => {
    expect(findEntity(ref, 'клиент молчит всю сессию')).toBeNull();
    expect(findEntity(ref, 'как работать')).toBeNull();
    expect(findEntity(ref, '')).toBeNull();
  });
});

describe('referenceAnswer', () => {
  it('«как работать со схемой» — первые предложения интервенций дословно и связи схемы', () => {
    const a = answer('как работать со схемой покинутости')!;
    const s = schema('abandonment');
    expect(a.intent).toBe('work');
    expect(s.interventions.join(' ')).toContain(a.text.split('. ')[0]);
    expect(a.links.find((l) => l.kind === 'technique')!.items.map((i) => i.id)).toEqual(s.techniques);
    expect(a.links.find((l) => l.kind === 'mode')!.items.every((i) => s.modeIds.includes(i.id))).toBe(true);
  });
  it('без намерения — суть схемы', () => {
    const a = answer('покинутость')!;
    expect(a.intent).toBe('essence');
    expect(schema('abandonment').essence).toContain(a.text.split('. ')[0]);
  });
  it('режим: работа — с цели; связанные схемы — те, что называют этот режим', () => {
    const a = answer('что делать с уязвимым ребёнком')!;
    const mode = guide.modeGuide(tr, 'vulnerable_child')!;
    expect(a.text.startsWith(mode.goal.split('. ')[0])).toBe(true);
    const schemas = a.links.find((l) => l.kind === 'schema')!.items;
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas.every((i) => schema(i.id).modeIds.includes('vulnerable_child'))).toBe(true);
  });
  it('техника: работа — шаги, суть — одна строка о ней; пустых связей нет', () => {
    const t = guide.techniqueGuide(tr, 'empathic_confrontation')!;
    expect(answer('как проводить эмпатическую конфронтацию')!.text.startsWith(t.steps[0].split('. ')[0])).toBe(true);
    const a = answer('эмпатическая конфронтация')!;
    expect(a.text.startsWith(t.summary.split('. ')[0])).toBe(true);
    expect(a.links.every((l) => l.items.length > 0 && l.items.length <= 6)).toBe(true);
  });
  it('у каждого листа справочника есть текст и для работы, и для сути', () => {
    for (const [key, s] of sources) expect([key, s.work.length > 0, s.essence.length > 0]).toEqual([key, true, true]);
  });
  it('лист не распознан — ответа нет', () => expect(answer('клиент молчит')).toBeNull());
});
