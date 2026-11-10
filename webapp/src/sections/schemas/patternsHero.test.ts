// @vitest-environment node
// Верх «Паттернов» (ревью g5 r1): под вводной схем второй кнопки теста нет; плитка теста на бумаге стоит
// только рядом с героем, чей оттенок отстоит от глины теста на 40° и больше; вводная режимов — Критик.
import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { ENTITY_LOOK, modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { NEIGHBOUR_HUE_GAP, hueGap } from '../../../../shared/src/theme/hueGap';
import { INTRO_LOOK, heroClass, heroWord, patternsHero, topPair, ysqEntryLook, type PatternsHero } from './patternsHero';

const base = { ready: true, top: null, hasSchemas: false, hasModes: false, hasEntries: false };
const top = (kind: 'schema' | 'mode', id: string) => ({ kind, id, days: 3, windowDays: 7 });

/** Все герои, которые может показать экран: вводные трёх шагов и «паттерн недели» каждой схемы и режима. */
const HEROES: PatternsHero[] = [
  patternsHero(base),
  patternsHero({ ...base, hasSchemas: true }),
  patternsHero({ ...base, hasSchemas: true, hasModes: true }),
  ...SCHEMA_DOMAINS.flatMap((d) => d.schemas.map((s) => patternsHero({ ...base, top: top('schema', s.id) }))),
  ...MODE_GROUPS.flatMap((g) => g.items.map((m) => patternsHero({ ...base, top: top('mode', m.id) }))),
];

describe('patternsHero — какой герой наверху', () => {
  it('пока профиль и записи не пришли — силуэт; есть паттерн недели — он; иначе вводная шага', () => {
    expect(patternsHero({ ...base, ready: false }).kind).toBe('loading');
    expect(patternsHero({ ...base, top: top('schema', 'abandonment') })).toMatchObject({ kind: 'week', look: { hue: 28 } });
    expect(patternsHero(base)).toMatchObject({ kind: 'intro', step: 'schemas' });
    expect(patternsHero({ ...base, hasSchemas: true, hasModes: true, hasEntries: true }).kind).toBe('none');
  });

  it('вводная режимов — вид группы Критика (слива + Looming), а не общий Cluster', () => {
    expect(INTRO_LOOK.modes).toEqual(modeGroupLook('critic'));
    expect(INTRO_LOOK.modes.sign).not.toBe(ENTITY_LOOK.modes.sign);
  });
});

describe('ysqEntryLook — вход в тест рядом с героем', () => {
  it('при вводной схем второй кнопки теста нет: вход уже в герое', () => {
    expect(ysqEntryLook(patternsHero(base), false)).toBe('hidden');
  });

  it('тест пройден, незаконченного нет — вход ведёт к результату и остаётся, белым под глиной героя', () => {
    expect(ysqEntryLook(patternsHero(base), false, true)).toBe('white');
  });

  it('пока герой грузится, вход не рисуется; героя нет (скрыт, всё пройдено) — бумага теста', () => {
    expect(ysqEntryLook(patternsHero({ ...base, ready: false }), false)).toBe('hidden');
    expect(ysqEntryLook(patternsHero(base), true)).toBe('paper');
    expect(ysqEntryLook(patternsHero({ ...base, hasSchemas: true, hasModes: true, hasEntries: true }), false)).toBe('paper');
  });

  it('бумага теста — только у героя, отстоящего от глины на 40° и больше; ближе — белый лист', () => {
    const seen = new Set<string>();
    for (const hero of HEROES) {
      if (hero.kind !== 'week' && hero.kind !== 'intro') continue;
      const entry = ysqEntryLook(hero, false);
      if (entry === 'hidden') continue;
      const gap = hueGap(hero.look.hue, ENTITY_LOOK.ysq.hue);
      expect(gap >= NEIGHBOUR_HUE_GAP, `${hero.look.hue} → ${entry}`).toBe(entry === 'paper');
      seen.add(entry);
    }
    // Контрольный образец: среди героев есть и те, и другие (глина «Покинутости», персик дневника — белый лист).
    expect([...seen].sort()).toEqual(['paper', 'white']);
    expect(ysqEntryLook(patternsHero({ ...base, top: top('schema', 'abandonment') }), false)).toBe('white');
    expect(ysqEntryLook(patternsHero({ ...base, hasSchemas: true, hasModes: true }), false)).toBe('white');
  });
});

// Ревью g5 r2: заголовок героя на телефоне рвался по слогам («Дефек-/тивность») — переноса нет, длинное слово
// берёт кегль по ширине листа (cs-hero--long), короткое остаётся кеглем героя.
describe('heroClass — длинное слово заголовка героя', () => {
  it('слово от 13 букв — cs-hero--long; короче — только cs-hero', () => {
    expect(heroClass('Дефективность')).toBe('cs-hero cs-hero--long');
    expect(heroClass('Привилегированность')).toBe('cs-hero cs-hero--long');
    expect(heroClass('Покинутость')).toBe('cs-hero');
    expect(heroClass('Картина недели появится из дневника')).toBe('cs-hero');
  });

  it('heroWord — буквы самого длинного слова: кегль cs-hero--long делит ширину листа на длину слова', () => {
    expect(heroWord('Недисциплинированный Ребёнок')).toBe(20);
    expect(heroWord('Самопожертвование')).toBe(17);
    expect(heroWord('Импульсивный / Недисциплинированный Ребёнок')).toBe(20);
    expect(heroWord('')).toBe(0);
  });
});

describe('topPair — верхняя пара «Выраженные + Тест» на компьютере', () => {
  it('пустых «Выраженных» нет — плитка теста одна; с данными или пока грузятся — пара', () => {
    expect(topPair(true, false, 0)).toEqual({ expressed: false, tile: true });
    expect(topPair(true, false, 5)).toEqual({ expressed: true, tile: true });
    expect(topPair(true, true, 0)).toEqual({ expressed: true, tile: true });
    expect(topPair(false, false, 3)).toEqual({ expressed: true, tile: false });
    expect(topPair(false, false, 0)).toEqual({ expressed: false, tile: false });
  });
});
