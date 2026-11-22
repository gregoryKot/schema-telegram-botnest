// Поиск «Справочника» по текстам листов: слово из текста находит лист и показывает кусок абзаца,
// название весит больше текста; сверка «собрал тексты → нашёл по ним» идёт через buildReferenceBody.
import { describe, it, expect } from 'vitest';
import { buildReference, type ReferenceTexts } from './guideReferenceModel';
import { buildReferenceBody, snippet } from './guideReferenceBody';
import { searchReference } from './guideReferenceSearch';
import {
  FIXTURE_GUIDE,
  FIXTURE_PRACTICE_NOTE,
  FIXTURE_SCHEMA_GUIDE,
  FIXTURE_TECHNIQUES,
} from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;
const texts: ReferenceTexts = {
  buildModeGuides: () => [
    { ...FIXTURE_GUIDE, modeId: 'vulnerable_child', what: 'Ребёнок остаётся один на один с тоской и страхом.' },
    { ...FIXTURE_GUIDE, modeId: 'angry_child', what: 'Гнев на то, что потребность не услышана.', more: ['Ярость копится неделями'] },
  ],
  buildSchemaDomainGuides: () => [{
    domainId: 'rejection', note: 'домен',
    schemas: [{ ...FIXTURE_SCHEMA_GUIDE, schemaId: 'abandonment', betweenSessions: [{ kind: 'custom', title: 'Письмо о разлуке', text: 'Написать и не отправлять' }] }],
  }],
  buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
  practiceNotes: () => [{ ...FIXTURE_PRACTICE_NOTE, points: ['Сверить контрперенос с супервизором'] }],
  buildConcernGuides: () => [{ id: 'bpd', name: 'Пограничное расстройство', goal: 'цель', essence: 'суть', differential: ['Голос Критика — псевдогаллюцинация'], sources: '' }],
};
const ref = buildReference(texts, tr);
const body = buildReferenceBody(texts, tr);
const ids = (query: string) => searchReference(ref, query, body).flatMap((g) => g.items.map((i) => i.id));
const only = (query: string) => searchReference(ref, query, body).flatMap((g) => g.items)[0];

describe('поиск по текстам листов', () => {
  it('слово из текста находит лист; под названием — кусок абзаца с этим словом', () => {
    expect(ids('тоской')).toEqual(['vulnerable_child']);
    expect(only('ТОСКОЙ').sub).toBe('…остаётся один на один с тоской и страхом.');
  });

  it('ищет во вложенных пунктах: «Подробнее», «Между сессиями», пункты раздела «Для терапевта»', () => {
    expect(ids('ярость')).toEqual(['angry_child']);
    expect(ids('разлуке')).toEqual(['abandonment']);
    expect(ids('контрперенос')).toEqual([FIXTURE_PRACTICE_NOTE.id]);
  });

  it('совпадение в названии — строка как была, без куска текста', () => {
    const hit = only('сердитый');
    expect(hit.id).toBe('angry_child');
    expect(hit.sub).toBeUndefined();
  });

  it('несколько слов: лист, где нашлись оба, — первым; где одно — ниже; ни одного — нет в выдаче', () => {
    expect(ids('ребёнок гнев')[0]).toBe('angry_child');
    expect(only('ребёнок гнев').sub).toBe('Гнев на то, что потребность не услышана.');
    expect(ids('ребёнок гнев')).toContain('vulnerable_child');
    expect(ids('ребёнок щщщщ').slice(0, 2)).toEqual(['vulnerable_child', 'angry_child']);
    expect(ids('щщщщ')).toEqual([]);
  });

  it('падеж не важен ни в названии, ни в тексте; служебные слова не ищутся', () => {
    expect(ids('сердитого ребёнка')[0]).toBe('angry_child');
    expect(ids('тоска')).toEqual(['vulnerable_child']);
    expect(ids('как работать с яростью')).toEqual(['angry_child']);
    expect(ids('как работать со схемой')).toEqual([]);
  });

  it('слово из подписи группы находит её листы — выше листов, где оно только в тексте', () => {
    expect(ids('детских').slice(0, 2)).toEqual(['vulnerable_child', 'angry_child']);
    expect(only('детских').sub).toBeUndefined();
  });

  it('слово короче трёх букв в тексте не ищется; идентификаторы — не текст', () => {
    expect(ids('на')).not.toContain('angry_child');
    expect(ids('angry_child')).toEqual([]);
  });

  it('слово из статьи «Запросов» находит её лист', () => {
    expect(only('псевдогаллюцинация')).toMatchObject({ kind: 'concern', id: 'bpd' });
  });

  it('без текстов поиск идёт только по названиям', () => {
    expect(searchReference(ref, 'тоской')).toEqual([]);
  });
});

describe('snippet', () => {
  const long = 'Первое длинное вступление про совсем другое, затем идёт мысль про контрперенос терапевта, '
    + 'и после неё ещё одно длинное придаточное, которое в строку списка уже никак не помещается целиком.';

  it('длинный абзац режется по границам слов, обрезанные края — с многоточием', () => {
    const cut = snippet(long, 'контрперенос');
    expect(cut.startsWith('…')).toBe(true);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).toContain('контрперенос терапевта');
    expect(long).toContain(cut.slice(1, -1));
    expect(cut.length).toBeLessThan(150);
  });

  it('короткий абзац — целиком', () => {
    expect(snippet('Гнев — сигнал.', 'гнев')).toBe('Гнев — сигнал.');
  });
});

describe('поисковые синонимы названий', () => {
  it('другой перевод названия схемы или режима находит лист; название, покрытое синонимом, — первым', () => {
    expect(ids('заброшенность')).toEqual(['abandonment']);
    expect(ids('злой ребёнок')[0]).toBe('angry_child');
    expect(only('заброшенность').name).toBe('Покинутость / Нестабильность');
  });
});
