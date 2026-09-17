// Тест новых типов ленты «Мой путь» — три быстрые практики (дыхание,
// заземление, «Стоп»), добавленные вместе с shared/src/practices, плюс
// остальные чистые функции архива (сортировка/фильтр/подпись/группировка).
import { describe, it, expect } from 'vitest';
import {
  JOURNEY_TYPE_META,
  JOURNEY_NEED_NAMES,
  journeyTypeMeta,
  sortJourneyItems,
  filterJourneyItems,
  journeyItemSubtitle,
  formatJourneyDate,
  formatJourneyDay,
  groupJourneyByMonth,
  buildJourneyCardRows,
  JOURNEY_GROUP_COLORS,
} from './journeyMeta';

describe('JOURNEY_TYPE_META — быстрые практики', () => {
  it('breathing: эмодзи, подпись, группа exercise', () => {
    expect(JOURNEY_TYPE_META.breathing).toEqual({
      emoji: '🌬',
      label: 'Дыхание',
      group: 'exercise',
    });
  });

  it('grounding: эмодзи, подпись, группа exercise', () => {
    expect(JOURNEY_TYPE_META.grounding).toEqual({
      emoji: '🌍',
      label: 'Заземление 5-4-3-2-1',
      group: 'exercise',
    });
  });

  it('stop: эмодзи, подпись, группа exercise', () => {
    expect(JOURNEY_TYPE_META.stop).toEqual({
      emoji: '🛑',
      label: 'Техника «Стоп»',
      group: 'exercise',
    });
  });

  it('journeyTypeMeta находит все три по ключу (не фолбэк)', () => {
    expect(journeyTypeMeta('breathing').label).toBe('Дыхание');
    expect(journeyTypeMeta('grounding').label).toBe('Заземление 5-4-3-2-1');
    expect(journeyTypeMeta('stop').label).toBe('Техника «Стоп»');
  });

  it('незнакомый тип с бэка → нейтральный фолбэк, лента не падает', () => {
    expect(journeyTypeMeta('совсем_новый_тип')).toEqual({
      emoji: '✨',
      label: 'Запись',
      group: 'exercise',
    });
  });
});

describe('sortJourneyItems / filterJourneyItems', () => {
  const items = [
    { type: 'tracker_day', at: '2026-07-01' },
    { type: 'schema_diary', at: '2026-07-03T10:00:00.000Z' },
    { type: 'letter', at: '2026-07-02T08:00:00.000Z' },
  ];

  it('сортирует по возрастанию/убыванию времени, не мутируя вход', () => {
    expect(sortJourneyItems(items, 'desc').map((i) => i.type)).toEqual([
      'schema_diary',
      'letter',
      'tracker_day',
    ]);
    expect(sortJourneyItems(items, 'asc').map((i) => i.type)).toEqual([
      'tracker_day',
      'letter',
      'schema_diary',
    ]);
    expect(items[0].type).toBe('tracker_day'); // исходный массив не тронут
  });

  it('фильтрует по группе; «all» отдаёт копию без фильтрации', () => {
    expect(filterJourneyItems(items, 'all')).toHaveLength(3);
    expect(filterJourneyItems(items, 'diary').map((i) => i.type)).toEqual([
      'schema_diary',
    ]);
    expect(filterJourneyItems(items, 'exercise').map((i) => i.type)).toEqual([
      'letter', // letter → group 'exercise'
    ]);
    expect(filterJourneyItems(items, 'cards')).toEqual([]);
  });
});

describe('journeyItemSubtitle', () => {
  const src = {
    getModeById: (id: string) =>
      id === 'vulnerable_child' ? { name: 'Уязвимый ребёнок' } : undefined,
    getSchemaById: (id: string) =>
      id === 'abandonment' ? { name: 'Покинутость' } : undefined,
  };

  it('приоритет: modeId → название режима', () => {
    expect(
      journeyItemSubtitle(
        { type: 'mode_diary', at: '', modeId: 'vulnerable_child' },
        src,
      ),
    ).toBe('Уязвимый ребёнок');
  });

  it('неизвестный modeId — null, а не «сырой» id', () => {
    expect(
      journeyItemSubtitle({ type: 'mode_diary', at: '', modeId: 'nope' }, src),
    ).toBeNull();
  });

  it('schemaIds → названия через запятую; неизвестные схемы отфильтрованы', () => {
    expect(
      journeyItemSubtitle(
        { type: 'schema_diary', at: '', schemaIds: ['abandonment', 'nope'] },
        src,
      ),
    ).toBe('Покинутость');
    expect(
      journeyItemSubtitle({ type: 'schema_diary', at: '', schemaIds: [] }, src),
    ).toBeNull();
  });

  it('needId → название потребности из JOURNEY_NEED_NAMES', () => {
    expect(
      journeyItemSubtitle({ type: 'practice', at: '', needId: 'play' }, src),
    ).toBe(JOURNEY_NEED_NAMES.play);
  });

  it('ничего из трёх полей нет — null', () => {
    expect(journeyItemSubtitle({ type: 'ysq', at: '' }, src)).toBeNull();
  });
});

describe('formatJourneyDate', () => {
  const now = new Date('2026-07-21T12:00:00');

  it('дата без времени и ISO-датавремя — день+месяц, год свой не показывается', () => {
    expect(formatJourneyDate('2026-07-03', now)).toBe('3 июля');
    expect(formatJourneyDate('2026-07-03T10:00:00.000Z', now)).toBe('3 июля');
  });

  it('чужой год добавляется к дате', () => {
    expect(formatJourneyDate('2025-12-31T23:00:00', now)).toContain('2025');
  });

  it('нечитаемая дата — пустая строка, не «Invalid Date»', () => {
    expect(formatJourneyDate('мусор', now)).toBe('');
  });
});

describe('formatJourneyDay', () => {
  it('день+месяц без года (компактная строка таймлайна)', () => {
    expect(formatJourneyDay('2026-07-03')).toBe('3 июля');
    expect(formatJourneyDay('мусор')).toBe('');
  });
});

describe('groupJourneyByMonth', () => {
  const now = new Date('2026-07-21T12:00:00');

  it('группирует ОТСОРТИРОВАННУЮ ленту по месяцам, сохраняя порядок', () => {
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
    expect(groups[0].label).toBe('Июль'); // свой год — без года
    expect(groups[1].label).toContain('2025'); // чужой год — с годом
    expect(groups[2].label).toBe('Раньше'); // нечитаемая дата не теряется
    expect(groups[0].items).toHaveLength(2);
  });

  it('пустая лента → без единой группы (не [{label: undefined}])', () => {
    expect(groupJourneyByMonth([], now)).toEqual([]);
  });
});

describe('buildJourneyCardRows', () => {
  it('режет по максимуму и подставляет эмодзи/подпись/цвет группы', () => {
    const rows = buildJourneyCardRows(
      Array.from({ length: 12 }, (_, i) => ({
        type: 'plan_done',
        at: `2026-07-${String(i + 1).padStart(2, '0')}`,
      })),
      8,
    );
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      emoji: '✅',
      label: 'Практика по плану',
      day: '1 июля',
      hex: JOURNEY_GROUP_COLORS.practice.hex,
    });
  });

  it('дефолтный максимум — 8 строк даже если записей больше', () => {
    const items = Array.from({ length: 20 }, () => ({
      type: 'note',
      at: '2026-07-01',
    }));
    expect(buildJourneyCardRows(items)).toHaveLength(8);
  });

  it('записей меньше максимума — отдаёт все', () => {
    expect(
      buildJourneyCardRows([{ type: 'note', at: '2026-07-01' }], 8),
    ).toHaveLength(1);
  });
});
