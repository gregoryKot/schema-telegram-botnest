// Раздел «Потребности» «Справочника»: пять потребностей в порядке NEED_ORDER, у каждой — её домен схем
// (правило №29: домен → потребность) и схемы домена из справочника; без таких схем потребности в списке нет.
import { describe, it, expect } from 'vitest';
import { buildNeedGuides, needBody, needGroups } from './guideReferenceNeeds';
import { buildReference, referenceLayout, REFERENCE_TABS, type ReferenceTexts } from './guideReferenceModel';
import { buildReferenceBody } from './guideReferenceBody';
import { searchReference } from './guideReferenceSearch';
import { findReferenceItem } from './guideSheetRoute';
import { buildNeedData, NEED_ORDER } from '../../../../shared/src/needs/needData';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import { buildSchemaDomainGuides, needGuides } from '../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_SCHEMA_GUIDE, FIXTURE_TECHNIQUES } from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;
const NOTE = 'Общее для домена: связь ненадёжна.';
const schema = (schemaId: string, need: string) => ({ ...FIXTURE_SCHEMA_GUIDE, schemaId, need });
const texts = (over: Partial<ReferenceTexts> = {}): ReferenceTexts => ({
  buildModeGuides: () => [],
  buildSchemaDomainGuides: () => [
    { domainId: 'vigilance', note: '', schemas: [schema('negativity', 'Право на ошибку')] },
    { domainId: 'rejection', note: NOTE, schemas: [schema('mistrust', 'Защита'), schema('abandonment', 'Надёжная связь')] },
    { domainId: 'limits', note: '', schemas: [] },
  ],
  buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
  practiceNotes: () => [],
  buildConcernGuides: () => [],
  buildPhaseGuides: () => [],
  ...over,
});

describe('buildNeedGuides', () => {
  it('сверка домен → потребность: пять пар, как в теории', () => {
    const pairs = buildNeedGuides({ buildSchemaDomainGuides }, tr).map((n) => [n.domain.id, n.id]);
    expect(pairs).toEqual([
      ['rejection', 'attachment'],
      ['autonomy', 'autonomy'],
      ['other_directed', 'expression'],
      ['vigilance', 'play'],
      ['limits', 'limits'],
    ]);
    expect(pairs.map((p) => p[1])).toEqual([...NEED_ORDER]);
  });

  it('живые тексты: у каждой потребности — все схемы её домена, у каждой схемы — строка потребности', () => {
    for (const n of buildNeedGuides({ buildSchemaDomainGuides }, tr)) {
      const domain = SCHEMA_DOMAINS.find((d) => d.id === n.domain.id)!;
      expect(n.schemas.map((s) => s.id)).toEqual(domain.schemas.map((s) => s.id));
      expect(n.schemas.every((s) => s.need.trim() !== '')).toBe(true);
    }
  });

  it('тексты потребности — из shared/src/needs; домен — название реестра и «общее для домена»; схемы — в порядке реестра', () => {
    const [attachment, play] = buildNeedGuides(texts(), tr);
    const data = buildNeedData(tr).attachment;
    expect(attachment).toEqual({
      id: 'attachment', name: data.name, subtitle: data.subtitle, guide: undefined,
      domain: { id: 'rejection', name: 'Нарушение связи и отвержение', note: NOTE },
      schemas: [
        { id: 'abandonment', name: 'Покинутость / Нестабильность', need: 'Надёжная связь' },
        { id: 'mistrust', name: 'Недоверие / Ожидание жестокого обращения', need: 'Защита' },
      ],
    });
    expect(play.id).toBe('play');
  });

  it('живые тексты: лист и подпись — текст для терапевта, клиентское описание в поиск не идёт', () => {
    const data = buildNeedData(tr);
    for (const n of buildNeedGuides({ buildSchemaDomainGuides, needGuides }, tr)) {
      const guide = needGuides().find((g) => g.id === n.id)!;
      expect(n.guide).toBe(guide);
      expect(n.subtitle).toBe(guide.subtitle);
      expect(needBody(n)).toContain(guide.frustration);
      expect(needBody(n)).not.toContain(data[n.id].desc);
    }
  });

  it('потребности без домена в справочнике и с доменом без схем в списке нет', () => {
    expect(buildNeedGuides(texts(), tr).map((n) => n.id)).toEqual(['attachment', 'play']);
    expect(buildNeedGuides(texts({ buildSchemaDomainGuides: () => [] }), tr)).toEqual([]);
  });
});

describe('раздел «Потребности» в справочнике', () => {
  const ref = buildReference(texts(), tr);

  it('третья вкладка, карточками; строка — знак потребности, название и подпись на бумаге своего домена', () => {
    expect(REFERENCE_TABS.map((t) => t.label)).toEqual(['Режимы', 'Схемы', 'Потребности', 'Техники', 'Запросы', 'Путь терапии', 'Для терапевта']);
    expect(referenceLayout('needs', false)).toBe('tiles');
    expect(ref.needs).toEqual(needGroups(buildNeedGuides(texts(), tr)));
    expect(ref.needs).toHaveLength(1);
    expect(ref.needs[0].look).toEqual({ hue: 45 });
    expect(ref.needs[0].items).toEqual([
      { kind: 'need', id: 'attachment', name: 'Привязанность', sub: 'Безопасность и связь', sign: 'need_attachment', hue: 28 },
      { kind: 'need', id: 'play', name: 'Спонтанность', sub: 'Игра и радость', sign: 'need_play', hue: 310 },
    ]);
  });

  it('нет ни одной потребности с доменом — раздела нет', () => {
    expect(buildReference(texts({ buildSchemaDomainGuides: () => [] }), tr).needs).toEqual([]);
  });

  it('поиск находит потребность по названию и по тексту листа; переход по адресу — по виду и id', () => {
    const body = buildReferenceBody(texts(), tr);
    expect(body.get('need:attachment')).toEqual(needBody(buildNeedGuides(texts(), tr)[0]));
    const byName = searchReference(ref, 'спонтанность', body);
    expect(byName.map((g) => [g.key, g.title])).toEqual([['needs:needs', 'Потребности']]);
    expect(byName[0].items.map((i) => i.id)).toEqual(['play']);
    const byText = searchReference(ref, 'ненадёжна', body).flatMap((g) => g.items);
    expect(byText.map((i) => [i.kind, i.id])).toEqual([['need', 'attachment']]);
    expect(byText[0].sub).toContain('ненадёжна');
    expect(findReferenceItem(ref, { kind: 'need', id: 'play' })?.name).toBe('Спонтанность');
    expect(findReferenceItem(ref, { kind: 'need', id: 'limits' })).toBeNull();
  });
});
