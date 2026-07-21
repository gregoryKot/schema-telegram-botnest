// Тесты shared-логики архива «Мой путь»: счётчики, сортировка/фильтр ленты,
// фолбэк незнакомого типа (новый тип с бэка не роняет UI) и текст шаринга.
import { describe, it, expect } from 'vitest';
import {
  JourneyCounts,
  JOURNEY_TYPE_META,
  journeyTypeMeta,
  journeyItemSubtitle,
  journeyStatRows,
  journeyTotal,
  sortJourneyItems,
  filterJourneyItems,
  formatJourneyDate,
} from '../../../shared/src/journey/journeyMeta';
import { journeyShareText } from '../../../shared/src/share/shareTexts';

const EMPTY: JourneyCounts = {
  trackerDays: 0,
  notes: 0,
  schemaDiary: 0,
  modeDiary: 0,
  gratitudeDays: 0,
  practices: 0,
  plansDone: 0,
  ysqTests: 0,
  childhoodDone: false,
  beliefChecks: 0,
  letters: 0,
  flashcards: 0,
  safePlace: false,
  schemaNotes: 0,
  modeNotes: 0,
};

describe('journeyStatRows / journeyTotal', () => {
  it('пустой аккаунт → ни одной строки и ноль шагов (без выдуманных цифр)', () => {
    expect(journeyStatRows(EMPTY)).toEqual([]);
    expect(journeyTotal(EMPTY)).toBe(0);
  });

  it('ненулевые счётчики → строки по убыванию, булевы считаются одним шагом', () => {
    const rows = journeyStatRows({
      ...EMPTY,
      trackerDays: 7,
      schemaDiary: 5,
      safePlace: true,
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Дни с трекером',
      'Схемный дневник',
      'Безопасное место',
    ]);
    expect(rows.map((r) => r.count)).toEqual([7, 5, 1]);
    expect(
      journeyTotal({
        ...EMPTY,
        trackerDays: 7,
        schemaDiary: 5,
        safePlace: true,
      }),
    ).toBe(13);
  });
});

describe('sortJourneyItems / filterJourneyItems', () => {
  const items = [
    { type: 'tracker_day', at: '2026-07-01' },
    { type: 'schema_diary', at: '2026-07-03T10:00:00.000Z' },
    { type: 'letter', at: '2026-07-02T08:00:00.000Z' },
  ];

  it('сортирует по времени в обе стороны, не мутируя вход', () => {
    const desc = sortJourneyItems(items, 'desc');
    expect(desc.map((i) => i.type)).toEqual([
      'schema_diary',
      'letter',
      'tracker_day',
    ]);
    const asc = sortJourneyItems(items, 'asc');
    expect(asc.map((i) => i.type)).toEqual([
      'tracker_day',
      'letter',
      'schema_diary',
    ]);
    expect(items[0].type).toBe('tracker_day'); // вход не тронут
  });

  it('фильтрует по группе, «all» отдаёт всё', () => {
    expect(filterJourneyItems(items, 'all')).toHaveLength(3);
    expect(filterJourneyItems(items, 'diary').map((i) => i.type)).toEqual([
      'schema_diary',
    ]);
    expect(filterJourneyItems(items, 'exercise').map((i) => i.type)).toEqual([
      'letter',
    ]);
  });
});

describe('journeyTypeMeta', () => {
  it('у каждого известного типа есть эмодзи и подпись', () => {
    for (const meta of Object.values(JOURNEY_TYPE_META)) {
      expect(meta.emoji).toBeTruthy();
      expect(meta.label).toBeTruthy();
    }
  });

  it('незнакомый тип с бэка → нейтральный фолбэк, не падение', () => {
    const meta = journeyTypeMeta('something_new');
    expect(meta.label).toBe('Запись');
  });
});

describe('journeyItemSubtitle', () => {
  const src = {
    getModeById: (id: string) =>
      id === 'vulnerable_child' ? { name: 'Уязвимый ребёнок' } : undefined,
    getSchemaById: (id: string) =>
      id === 'abandonment' ? { name: 'Покинутость' } : undefined,
  };

  it('режим/схема/потребность → название; неизвестное — null, не id', () => {
    expect(
      journeyItemSubtitle(
        { type: 'mode_diary', at: '', modeId: 'vulnerable_child' },
        src,
      ),
    ).toBe('Уязвимый ребёнок');
    expect(
      journeyItemSubtitle(
        { type: 'schema_diary', at: '', schemaIds: ['abandonment', 'nope'] },
        src,
      ),
    ).toBe('Покинутость');
    expect(
      journeyItemSubtitle({ type: 'practice', at: '', needId: 'play' }, src),
    ).toBe('Спонтанность');
    expect(
      journeyItemSubtitle({ type: 'mode_diary', at: '', modeId: 'nope' }, src),
    ).toBeNull();
    expect(journeyItemSubtitle({ type: 'ysq', at: '' }, src)).toBeNull();
  });
});

describe('formatJourneyDate', () => {
  const now = new Date('2026-07-21T12:00:00');
  it('дата без времени и ISO-датавремя; год — только чужой', () => {
    expect(formatJourneyDate('2026-07-03', now)).toBe('3 июля');
    expect(formatJourneyDate('2025-12-31T23:00:00', now)).toContain('2025');
    expect(formatJourneyDate('мусор', now)).toBe('');
  });
});

describe('journeyShareText', () => {
  it('склоняет и не содержит ты/вы-форм', () => {
    const t = journeyShareText(21, 'https://t.me/bot');
    expect(t).toContain('21 запись');
    expect(t).toContain('https://t.me/bot');
    expect(t).not.toMatch(/\b(ты|тебя|тебе|вы|вас|вам)\b/i);
  });
});
