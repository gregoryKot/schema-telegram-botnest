// Тесты shared-логики архива «Мой путь»: счётчики, сортировка/фильтр ленты,
// фолбэк незнакомого типа (новый тип с бэка не роняет UI) и текст шаринга.
import { describe, it, expect } from 'vitest';
import {
  JourneyCounts,
  JOURNEY_TYPE_META,
  journeyTypeMeta,
  journeyItemSubtitle,
  sortJourneyItems,
  filterJourneyItems,
  formatJourneyDate,
  groupJourneyByMonth,
  buildJourneyCardRows,
  filterJourneyByPeriod,
} from '../../../shared/src/journey/journeyMeta';
import {
  journeyStatRows,
  journeyTotal,
} from '../../../shared/src/journey/journeyStats';
import { buildJourneyResultParts } from '../../../shared/src/journey/journeyContent';
import {
  journeyShareText,
  journeyItemShareText,
} from '../../../shared/src/share/shareTexts';

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

describe('groupJourneyByMonth', () => {
  const now = new Date('2026-07-21T12:00:00');
  it('группирует отсортированную ленту по месяцам, сохраняя порядок', () => {
    const groups = groupJourneyByMonth(
      [
        { type: 'tracker_day', at: '2026-07-20' },
        { type: 'note', at: '2026-07-01' },
        { type: 'ysq', at: '2025-12-31T10:00:00.000Z' },
        { type: 'letter', at: 'мусор' },
      ],
      now,
    );
    expect(groups.map((g) => g.key)).toEqual(['2026-07', '2025-12', 'undated']);
    expect(groups[0].label).toBe('Июль');
    expect(groups[1].label).toContain('2025'); // чужой год — с годом
    expect(groups[2].label).toBe('Раньше'); // нечитаемая дата не теряется
    expect(groups[0].items).toHaveLength(2);
  });

  it('пустая лента → без групп', () => {
    expect(groupJourneyByMonth([], now)).toEqual([]);
  });
});

describe('buildJourneyCardRows', () => {
  it('режет по максимуму и подставляет мету с цветом группы', () => {
    const rows = buildJourneyCardRows(
      Array.from({ length: 12 }, (_, i) => ({
        type: 'plan_done',
        at: `2026-07-${String(i + 1).padStart(2, '0')}`,
      })),
      8,
    );
    expect(rows).toHaveLength(8);
    expect(rows[0].label).toBe('Практика по плану');
    expect(rows[0].emoji).toBe('✅');
    expect(rows[0].hex).toMatch(/^#/);
    expect(rows[0].day).toContain('июля');
  });
});

describe('journeyItemShareText', () => {
  it('без ты/вы-форм, с эмодзи и ссылкой', () => {
    const t = journeyItemShareText('✅', 'Практика по плану', 't.me/bot');
    expect(t).toContain('✅ Практика по плану');
    expect(t).toContain('t.me/bot');
    expect(t).not.toMatch(/\b(ты|тебя|тебе|вы|вас|вам)\b/i);
  });
});

describe('filterJourneyByPeriod', () => {
  const now = new Date('2026-07-21T12:00:00');
  const items = [
    { type: 'tracker_day', at: '2026-07-20' },
    { type: 'note', at: '2026-07-10' },
    { type: 'ysq', at: '2026-05-01T10:00:00.000Z' },
    { type: 'letter', at: 'мусор' },
  ];

  it('неделя и месяц — скользящие 7/30 дней; «всё время» не режет', () => {
    expect(filterJourneyByPeriod(items, 'all', now)).toHaveLength(4);
    expect(filterJourneyByPeriod(items, 'week', now).map((i) => i.at)).toEqual([
      '2026-07-20',
    ]);
    expect(filterJourneyByPeriod(items, 'month', now).map((i) => i.at)).toEqual(
      ['2026-07-20', '2026-07-10'],
    );
  });
});

describe('buildJourneyResultParts', () => {
  it('проверка убеждения → убеждение + здоровый взгляд', () => {
    const parts = buildJourneyResultParts('belief_check', {
      id: 1,
      belief: 'Я всегда всё порчу',
      reframe: 'Ошибки — часть обучения',
    });
    expect(parts).toEqual([
      { title: 'Убеждение', text: 'Я всегда всё порчу' },
      { title: 'Здоровый взгляд', text: 'Ошибки — часть обучения' },
    ]);
  });

  it('пустые/отсутствующие поля не создают частей; длинное режется с многоточием', () => {
    expect(buildJourneyResultParts('belief_check', { belief: '  ' })).toEqual(
      [],
    );
    expect(buildJourneyResultParts('letter', null)).toEqual([]);
    const long = 'слово '.repeat(60).trim();
    const [part] = buildJourneyResultParts('letter', { text: long });
    expect(part.text.length).toBeLessThanOrEqual(221);
    expect(part.text.endsWith('…')).toBe(true);
  });

  it('благодарность → до трёх пунктов; неизвестный тип → пусто', () => {
    expect(
      buildJourneyResultParts('gratitude', {
        items: ['солнце', 'кофе', 'разговор', 'четвёртое'],
      }),
    ).toHaveLength(3);
    expect(buildJourneyResultParts('tracker_day', { any: 1 })).toEqual([]);
  });
});

describe('buildJourneyResultParts — трекер, карточки, тест', () => {
  it('день трекера → оценки потребностей одной строкой в фиксированном порядке', () => {
    const [part] = buildJourneyResultParts('tracker_day', {
      play: 4,
      attachment: 7,
      limits: 6,
    });
    expect(part.title).toBe('Оценки дня (из 10)');
    expect(part.text).toBe(
      'Привязанность — 7 · Спонтанность — 4 · Границы — 6',
    );
  });

  it('день трекера без оценок → пусто (нет выдуманных цифр)', () => {
    expect(buildJourneyResultParts('tracker_day', {})).toEqual([]);
  });

  it('карточка схемы/режима → заполненные поля с подписями', () => {
    expect(
      buildJourneyResultParts('schema_note', {
        schemaId: 'abandonment',
        triggers: 'Молчание в ответ',
        healthyView: 'Пауза — не уход',
        behavior: '',
      }),
    ).toEqual([
      { title: 'Триггеры', text: 'Молчание в ответ' },
      { title: 'Здоровый взгляд', text: 'Пауза — не уход' },
    ]);
    expect(
      buildJourneyResultParts('mode_note', { needs: 'Поддержка' }),
    ).toEqual([{ title: 'Что мне нужно', text: 'Поддержка' }]);
  });

  it('тест схем → число выраженных схем из scores', () => {
    const [part] = buildJourneyResultParts('ysq', {
      id: 1,
      completedAt: '2026-07-01',
      scores: [
        { id: 'abandonment', pct5plus: 60 },
        { id: 'mistrust', pct5plus: 10 },
      ],
    });
    expect(part.text).toBe('Выраженных схем: 1 из 20');
    expect(buildJourneyResultParts('ysq', { scores: 'мусор' })).toEqual([]);
  });
});
