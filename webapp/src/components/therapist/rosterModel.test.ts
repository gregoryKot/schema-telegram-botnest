import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';
import { filterRoster, sortRoster, meetingLabel, clientCaption, clientStatus, domainBar, schemaChips, rosterName, rosterInitials } from './rosterModel';

const TODAY = '2026-10-03';

function client(over: Partial<TherapyClientSummary>): TherapyClientSummary {
  return {
    telegramId: 1,
    name: 'Аня',
    clientAlias: null,
    streak: 0,
    lastActiveDate: null,
    todayIndex: null,
    recentIndexHistory: [],
    relationCreatedAt: '2026-01-01',
    therapyStartDate: null,
    nextSession: null,
    meetingDays: [],
    schemaIds: [],
    ...over,
  };
}

// Офлайн-клиент: name непустой (имя из карточки), telegramId отрицательный.
const offline = (over: Partial<TherapyClientSummary> = {}) =>
  client({ telegramId: -7, name: 'Борис', ...over });

describe('filterRoster', () => {
  const online = client({ telegramId: 1, name: 'Аня' });
  const activeOnline = client({ telegramId: 2, name: 'Вера', lastActiveDate: TODAY });
  const off = offline();
  const all = [online, activeOnline, off];

  it('all: без фильтров возвращает всех', () => {
    expect(filterRoster(all, '', 'all', TODAY)).toHaveLength(3);
  });

  it('active: только активные сегодня', () => {
    expect(filterRoster(all, '', 'active', TODAY)).toEqual([activeOnline]);
  });

  it('wait: офлайн-клиент с непустым name не попадает в «Ждут»', () => {
    expect(filterRoster(all, '', 'wait', TODAY)).toEqual([online]);
  });

  it('virtual: определяется по отрицательному telegramId, а не по name', () => {
    expect(filterRoster(all, '', 'virtual', TODAY)).toEqual([off]);
  });

  it('поиск идёт по clientAlias, затем по name, без учёта регистра и пробелов', () => {
    const aliased = client({ telegramId: 3, name: 'Игорь', clientAlias: 'Пётр' });
    expect(filterRoster([aliased], ' пёт ', 'all', TODAY)).toEqual([aliased]);
    expect(filterRoster([aliased], 'игор', 'all', TODAY)).toEqual([]);
    expect(filterRoster(all, 'ВЕР', 'all', TODAY)).toEqual([activeOnline]);
  });

  it('поиск и статус работают вместе', () => {
    expect(filterRoster(all, 'бор', 'wait', TODAY)).toEqual([]);
    expect(filterRoster(all, 'бор', 'virtual', TODAY)).toEqual([off]);
  });

  it('не мутирует исходный массив', () => {
    const copy = [...all];
    filterRoster(all, '', 'all', TODAY);
    expect(all).toEqual(copy);
  });
});

describe('sortRoster', () => {
  it('сначала ближайшие встречи по возрастанию, затем остальные по имени', () => {
    const later = client({ telegramId: 1, name: 'Яна', nextSession: '2026-10-09T10:00' });
    const sooner = client({ telegramId: 2, name: 'Яков', nextSession: '2026-10-05T18:00' });
    const sameDayEarlier = client({ telegramId: 3, name: 'Ян', nextSession: '2026-10-05T09:00' });
    const noMeetB = client({ telegramId: 4, name: 'Борис' });
    const noMeetA = client({ telegramId: 5, name: 'Анна' });
    const sorted = sortRoster([later, noMeetB, sooner, noMeetA, sameDayEarlier], TODAY);
    expect(sorted.map((c) => c.telegramId)).toEqual([3, 2, 1, 5, 4]);
  });

  it('встреча сегодня считается будущей, прошедшая — нет', () => {
    const today = client({ telegramId: 1, name: 'Яна', nextSession: '2026-10-03T12:00' });
    const past = client({ telegramId: 2, name: 'Аня', nextSession: '2026-10-01T12:00' });
    expect(sortRoster([past, today], TODAY).map((c) => c.telegramId)).toEqual([1, 2]);
  });

  it('имя берётся из clientAlias; пустые поля не ломают порядок', () => {
    const a = client({ telegramId: 1, name: null, clientAlias: null });
    const b = client({ telegramId: 2, name: 'Вика' });
    const c = client({ telegramId: 3, name: 'Игорь', clientAlias: 'Аркадий' });
    expect(sortRoster([b, c, a], TODAY).map((x) => x.telegramId)).toEqual([1, 3, 2]);
  });

  it('сортирует по русскому алфавиту (ё и е рядом)', () => {
    const e = client({ telegramId: 1, name: 'Ева' });
    const yo = client({ telegramId: 2, name: 'Ёлка' });
    const zh = client({ telegramId: 3, name: 'Жанна' });
    expect(sortRoster([zh, yo, e], TODAY).map((x) => x.telegramId)).toEqual([1, 2, 3]);
  });
});

describe('meetingLabel', () => {
  it('будущая встреча: день недели, дата и время', () => {
    // 2026-10-07 — среда
    expect(meetingLabel(client({ nextSession: '2026-10-07T11:00' }), TODAY)).toBe('Ср, 7 окт · 11:00');
  });

  it('встреча сегодня показывается', () => {
    expect(meetingLabel(client({ nextSession: '2026-10-03' }), TODAY)).toBe('Сб, 3 окт');
  });

  it('прошедшая встреча не показывается, вместо неё — дни приёма', () => {
    const c = client({ nextSession: '2026-09-30T10:00', meetingDays: [2] });
    expect(meetingLabel(c, TODAY)).toBe('по Вт');
  });

  it('прошедшая встреча без дней приёма — null', () => {
    expect(meetingLabel(client({ nextSession: '2026-09-30T10:00' }), TODAY)).toBeNull();
  });

  it('дни приёма идут Пн..Вс, воскресенье (0) последним', () => {
    expect(meetingLabel(client({ meetingDays: [0, 4, 2] }), TODAY)).toBe('по Вт, Чт, Вс');
  });

  it('повторы дней схлопываются', () => {
    expect(meetingLabel(client({ meetingDays: [1, 1, 3] }), TODAY)).toBe('по Пн, Ср');
  });

  it('ничего нет — null', () => {
    expect(meetingLabel(client({}), TODAY)).toBeNull();
  });
});

describe('clientCaption', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T06:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  // Аудит 2026-10: подписи были в мужском роде («активен сегодня», «был
  // недавно», «не активен») о человеке, чей пол неизвестен.
  it('Telegram-клиент: активность сегодня', () => {
    expect(clientCaption(client({ lastActiveDate: TODAY }), TODAY)).toBe('активность сегодня');
  });

  it('Telegram-клиент: давность активности + стрик', () => {
    expect(clientCaption(client({ lastActiveDate: '2026-10-01', streak: 4 }), TODAY)).toBe(
      'активность 2 дн. назад · стрик 4 дн.',
    );
    expect(clientCaption(client({ lastActiveDate: '2026-10-02' }), TODAY)).toBe('активность вчера');
  });

  // Раньше любая не сегодняшняя дата читалась «активность недавно» — и для
  // месячной давности тоже; мини-апп в той же роли показывает дату.
  it('месячная давность — дата, а не «недавно», в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect(clientCaption(client({ lastActiveDate: '2026-09-01' }), TODAY), tz).toBe('активность 1 сен');
    });
  });

  it('Telegram-клиент: нет активности, без стрика', () => {
    expect(clientCaption(client({}), TODAY)).toBe('нет активности');
  });

  it('ни в одной ветке активности нет мужского рода о клиенте', () => {
    const captions = [
      clientCaption(client({ lastActiveDate: TODAY, streak: 2 }), TODAY),
      clientCaption(client({ lastActiveDate: '2026-09-01' }), TODAY),
      clientCaption(client({}), TODAY),
    ];
    for (const caption of captions) {
      expect(caption).not.toMatch(/активен|был|заходил/);
    }
  });

  it('офлайн без даты начала — подписи нет', () => {
    expect(clientCaption(offline(), TODAY)).toBeNull();
  });

  it('срок работы', () => {
    expect(clientCaption(offline({ therapyStartDate: '2026-07-03' }), TODAY)).toBe('в работе 3 месяца');
    expect(clientCaption(offline({ therapyStartDate: '2026-10-01' }), TODAY)).toBe('в работе 2 дня');
  });

  it('начали сегодня', () => {
    expect(clientCaption(offline({ therapyStartDate: TODAY }), TODAY)).toBe('с сегодняшнего дня');
  });

  it('офлайн: стрик и активность не показываются, даже если поля заполнены', () => {
    expect(clientCaption(offline({ streak: 5, lastActiveDate: TODAY }), TODAY)).toBeNull();
  });

  it('офлайн с непарсящейся датой начала — подписи нет', () => {
    expect(clientCaption(offline({ therapyStartDate: 'мусор' }), TODAY)).toBeNull();
  });
});

describe('clientStatus', () => {
  it('Telegram-клиент — в боте', () => {
    expect(clientStatus(client({}))).toEqual({ label: 'в боте', inBot: true });
  });
  it('офлайн по отрицательному id, а не по name', () => {
    expect(clientStatus(offline())).toEqual({ label: 'оффлайн', inBot: false });
  });
});

describe('domainBar / schemaChips', () => {
  const [d1, d2] = SCHEMA_DOMAINS;
  const ids = [d2.schemas[0].id, d1.schemas[0].id, d1.schemas[1].id, 'unknown'];

  it('сегменты в порядке доменов, count = число схем клиента в домене', () => {
    expect(domainBar(ids)).toEqual([
      { domainId: d1.id, count: 2 },
      { domainId: d2.id, count: 1 },
    ]);
  });

  it('нет схем — нет сегментов', () => {
    expect(domainBar([])).toEqual([]);
  });

  it('чипы: все известные схемы по доменам, неизвестные id пропущены', () => {
    const chips = schemaChips(ids);
    expect(chips.map((c) => c.id)).toEqual([d1.schemas[0].id, d1.schemas[1].id, d2.schemas[0].id]);
    expect(chips[0]).toEqual({ id: d1.schemas[0].id, name: d1.schemas[0].name, domainId: d1.id });
  });
});

describe('rosterName / rosterInitials', () => {
  it('алиас важнее имени, без обоих — ID', () => {
    expect(rosterName(client({ clientAlias: 'А.К.', name: 'Аня' }))).toBe('А.К.');
    expect(rosterName(client({ name: null }))).toBe('ID 1');
  });
  it('инициалы: две буквы, пустое имя — «?»', () => {
    expect(rosterInitials('анна к.')).toBe('АК');
    expect(rosterInitials('Борис')).toBe('Б');
    expect(rosterInitials('  ')).toBe('?');
  });
});
