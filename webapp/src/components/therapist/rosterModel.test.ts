import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { filterRoster, sortRoster, meetingLabel, clientStatus, rosterActivity, rosterMeeting, rosterSchemas } from './rosterModel';

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
  // «Активна сегодня» — по календарю клиента: daysSinceActive отдаёт сервер.
  const activeOnline = client({ telegramId: 2, name: 'Вера', lastActiveDate: TODAY, daysSinceActive: 0 });
  const off = offline();
  const all = [online, activeOnline, off];

  it('all: без фильтров возвращает всех', () => {
    expect(filterRoster(all, '', 'all')).toHaveLength(3);
  });

  it('active: только активные сегодня', () => {
    expect(filterRoster(all, '', 'active')).toEqual([activeOnline]);
  });

  it('wait: офлайн-клиент с непустым name не попадает в «Ждут»', () => {
    expect(filterRoster(all, '', 'wait')).toEqual([online]);
  });

  it('virtual: определяется по отрицательному telegramId, а не по name', () => {
    expect(filterRoster(all, '', 'virtual')).toEqual([off]);
  });

  it('поиск идёт по clientAlias, затем по name, без учёта регистра и пробелов', () => {
    const aliased = client({ telegramId: 3, name: 'Игорь', clientAlias: 'Пётр' });
    expect(filterRoster([aliased], ' пёт ', 'all')).toEqual([aliased]);
    expect(filterRoster([aliased], 'игор', 'all')).toEqual([]);
    expect(filterRoster(all, 'ВЕР', 'all')).toEqual([activeOnline]);
  });

  // Поиск — по той же подписи, что видна в списке: клиента без имени находит его номер.
  it('клиента без имени находит «без имени» и номер из подписи', () => {
    const noName = client({ telegramId: 77, name: null, clientAlias: null });
    expect(filterRoster([noName, online], '77', 'all')).toEqual([noName]);
    expect(filterRoster([noName, online], 'без имени', 'all')).toEqual([noName]);
  });

  // QA 2026-11: «е» не находила «ё» и наоборот — терапевт набирает как привык.
  it('поиск не различает «е» и «ё» в обе стороны', () => {
    const pyotr = client({ telegramId: 3, clientAlias: 'Пётр' });
    const alena = client({ telegramId: 5, name: 'Алена' });
    expect(filterRoster([pyotr, alena], 'петр', 'all')).toEqual([pyotr]);
    expect(filterRoster([pyotr, alena], 'Алёна', 'all')).toEqual([alena]);
  });

  it('поиск и статус работают вместе', () => {
    expect(filterRoster(all, 'бор', 'wait')).toEqual([]);
    expect(filterRoster(all, 'бор', 'virtual')).toEqual([off]);
  });

  // QA 2026-10-26: lastActiveDate — день КЛИЕНТА; совпадение с днём терапевта
  // ничего не значит (в 00:10 по Москве у клиента из Москвы уже другое число).
  it('active: совпадение lastActiveDate с днём терапевта — не «сегодня» без daysSinceActive === 0', () => {
    const yesterdayForClient = client({ telegramId: 4, lastActiveDate: TODAY, daysSinceActive: 1 });
    expect(filterRoster([yesterdayForClient], '', 'active')).toEqual([]);
    expect(filterRoster([yesterdayForClient], '', 'wait')).toEqual([yesterdayForClient]);
  });

  it('не мутирует исходный массив', () => {
    const copy = [...all];
    filterRoster(all, '', 'all');
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

  it('порядок — по видимой подписи: алиас, имя, «Без имени · id»', () => {
    const a = client({ telegramId: 1, name: null, clientAlias: null });
    const b = client({ telegramId: 2, name: 'Вика' });
    const c = client({ telegramId: 3, name: 'Игорь', clientAlias: 'Аркадий' });
    expect(sortRoster([b, c, a], TODAY).map((x) => x.telegramId)).toEqual([3, 1, 2]);
  });

  it('сортирует по русскому алфавиту (ё и е рядом)', () => {
    const e = client({ telegramId: 1, name: 'Ева' });
    const yo = client({ telegramId: 2, name: 'Ёлка' });
    const zh = client({ telegramId: 3, name: 'Жанна' });
    expect(sortRoster([zh, yo, e], TODAY).map((x) => x.telegramId)).toEqual([1, 2, 3]);
  });
});

describe('meetingLabel', () => {
  // fmtDate показывает год, если он не текущий: часы закреплены за 2026.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`)); });
  afterEach(() => vi.useRealTimers());

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

describe('rosterActivity', () => {
  // Давность — по календарю клиента (daysSinceActive от сервера, №25), без рода о клиенте.
  it('клиент в приложении — давность; без записей — «нет активности»; офлайн — «офлайн»', () => {
    expect(rosterActivity(client({ lastActiveDate: TODAY, daysSinceActive: 0, streak: 4 }))).toBe('активность сегодня');
    expect(rosterActivity(client({ lastActiveDate: '2026-10-01', daysSinceActive: 2 }))).toBe('активность 2 дн. назад');
    expect(rosterActivity(client({}))).toBe('нет активности');
    expect(rosterActivity(offline({ streak: 5, lastActiveDate: TODAY, therapyStartDate: '2026-07-03' }))).toBe('офлайн');
  });
});

describe('rosterMeeting', () => {
  it('есть встреча — её подпись, нет — «—»', () => {
    expect(rosterMeeting(client({ meetingDays: [4] }), TODAY)).toBe('по Чт');
    expect(rosterMeeting(client({}), TODAY)).toBe('—');
  });
});

describe('clientStatus', () => {
  // Аудит 2026-11, U11: клиент сайта в боте не бывает — метка по факту.
  it('клиент с аккаунтом — в приложении', () => {
    expect(clientStatus(client({}))).toEqual({ label: 'в приложении', inBot: true });
  });
  it('офлайн по отрицательному id, а не по name', () => {
    expect(clientStatus(offline())).toEqual({ label: 'офлайн', inBot: false });
  });
});

describe('rosterSchemas', () => {
  const names = SCHEMA_DOMAINS.flatMap((d) => d.schemas).slice(0, 5);
  const short = (n: string) => n.split(' / ')[0];
  it('пусто — пустая строка; до двух — обе коротким именем', () => {
    expect(rosterSchemas([])).toBe('');
    expect(rosterSchemas([names[1].id, 'unknown'])).toBe(short(names[1].name));
    expect(rosterSchemas([names[2].id, names[1].id])).toBe(`${short(names[1].name)}\u00a0· ${short(names[2].name)}`);
  });
  it('больше двух — две по порядку доменов и «ещё N»', () => {
    expect(rosterSchemas(names.slice(0, 3).map((s) => s.id))).toBe(`${short(names[0].name)}\u00a0· ${short(names[1].name)}\u00a0· ещё\u00a01`);
    expect(rosterSchemas(names.map((s) => s.id))).toMatch(/\u00a0· ещё\u00a03$/);
  });
  it('короткое имя без хвоста через «/»', () => {
    expect(rosterSchemas(['mistrust'])).toBe('Недоверие');
  });
});
