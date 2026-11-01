import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildDiaryFeed, buildTodayFeed, casesTodayCount, trackerSummary, trackerTileMeta, caseTileMeta,
  diaryTileMeta, lastEntryAt, fmtIndex, type FeedEntry,
} from './todayFeed';
import { forEachTimeZone, withTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';
import { diaryToday } from '../../../../shared/src/diary/diaryDay';

const NEEDS = ['a', 'b', 'c', 'd', 'e'];
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const noon = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString(); };
const earlier = () => { const d = new Date(); d.setHours(9, 0, 0, 0); return d.toISOString(); };
const longAgo = () => new Date(Date.now() - 5 * 86_400_000).toISOString();

describe('trackerSummary', () => {
  it('считает оценённые потребности; индекс только когда оценены все', () => {
    expect(trackerSummary(NEEDS, {})).toEqual({ filled: 0, total: 5, index: null });
    expect(trackerSummary(NEEDS, { a: 4, c: 6 })).toEqual({ filled: 2, total: 5, index: null });
    expect(trackerSummary(NEEDS, { a: 4, b: 6, c: 6, d: 8, e: 6 })).toEqual({ filled: 5, total: 5, index: 6 });
  });
  it('оценка чужой потребности не засчитывается', () => {
    expect(trackerSummary(NEEDS, { zzz: 5 }).filled).toBe(0);
  });
});

describe('buildDiaryFeed — только сегодня', () => {
  it('берёт записи трёх дневников за сегодня и отбрасывает старые', () => {
    const feed = buildDiaryFeed({
      schema: [
        { id: 1, trigger: 'Коллега не ответил', createdAt: noon() },
        { id: 2, trigger: 'Старое', createdAt: longAgo() },
      ],
      mode: [{ id: 3, situation: 'Критик громко', createdAt: earlier() }],
      gratitude: [{ id: 4, items: ['чай'], date: diaryToday(), createdAt: hoursAgo(0) }],
    });
    expect(feed.map(e => e.kind).sort()).toEqual(['gratitude', 'mode', 'schema']);
    expect(feed.find(e => e.kind === 'schema')?.text).toBe('Коллега не ответил');
  });

  it('запись режима с fromCase идёт в ленту как «case», обычная — как «mode»', () => {
    const feed = buildDiaryFeed({
      schema: [],
      mode: [
        { id: 1, situation: 'разбор', createdAt: noon(), fromCase: true },
        { id: 2, situation: 'обычная', createdAt: earlier() },
      ],
      gratitude: [],
    });
    expect(feed.find(e => e.key === 'mode-1')?.kind).toBe('case');
    expect(feed.find(e => e.key === 'mode-2')?.kind).toBe('mode');
  });

  it('casesTodayCount считает только сегодняшние разборы', () => {
    expect(casesTodayCount({ mode: [
      { id: 1, situation: 'с', createdAt: noon(), fromCase: true },
      { id: 2, situation: 'с', createdAt: longAgo(), fromCase: true },
      { id: 3, situation: 'с', createdAt: noon() },
    ] })).toBe(1);
    expect(casesTodayCount({ mode: [] })).toBe(0);
  });

  it('длинный текст режется, у пустой благодарности запасная подпись', () => {
    const feed = buildDiaryFeed({
      schema: [{ id: 1, trigger: 'я'.repeat(200), createdAt: noon() }],
      mode: [],
      gratitude: [{ id: 2, items: [], date: diaryToday(), createdAt: noon() }],
    });
    expect(feed.find(e => e.kind === 'schema')?.text).toHaveLength(80);
    expect(feed.find(e => e.kind === 'gratitude')?.text).toBe('Благодарность');
  });

  it('«сегодня» — по локальному дню читателя в любой зоне', () => {
    forEachTimeZone((tz) => {
      const feed = buildDiaryFeed({
        schema: [{ id: 1, trigger: 'т', createdAt: new Date().toISOString() }],
        mode: [{ id: 2, situation: 'с', createdAt: longAgo() }],
        gratitude: [],
      });
      expect(feed.map(e => e.key), tz).toEqual(['schema-1']);
    });
  });
});

// Инцидент 2026-10-26: в 00:19 по Москве (21:19 UTC) «сегодня» — уже 27-е.
// Благодарность пишется местным днём (shared/src/diary/diaryDay.ts) — так её
// и узнаёт лента дня; гринвичское 26-е — уже вчера.
describe('buildDiaryFeed — благодарность сегодня по местному дню', () => {
  afterEach(() => { vi.useRealTimers(); });
  const at = (date: string) => withTimeZone('Europe/Moscow', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:19:00Z'));
    return buildDiaryFeed({
      schema: [], mode: [],
      gratitude: [{ id: 3, items: ['чай'], date, createdAt: '2026-10-26T21:18:00Z' }],
    }).map(e => e.key);
  });

  it('запись 27-го — в ленте сегодня', () => {
    expect(at('2026-10-27')).toEqual(['gratitude-3']);
  });

  it('запись 26-го (гринвичское «сегодня») — уже вчера', () => {
    expect(at('2026-10-26')).toEqual([]);
  });
});

describe('buildTodayFeed', () => {
  const diary: FeedEntry[] = [
    { key: 'mode-1', kind: 'mode', time: '09:00', text: 'раньше', sortKey: '2026-10-27T06:00:00Z' },
    { key: 'schema-2', kind: 'schema', time: '12:00', text: 'позже', sortKey: '2026-10-27T09:00:00Z' },
  ];

  it('сортирует по времени, свежие первыми; без оценок трекера строки нет', () => {
    const feed = buildTodayFeed(diary, { filled: 0, total: 5, index: null });
    expect(feed.map(e => e.key)).toEqual(['schema-2', 'mode-1']);
  });

  it('трекер одной строкой после записей со временем: частично — «N из 5»', () => {
    const feed = buildTodayFeed(diary, { filled: 2, total: 5, index: null });
    expect(feed.map(e => e.key)).toEqual(['schema-2', 'mode-1', 'tracker']);
    expect(feed[2].text).toBe('Трекер: 2 из 5');
  });

  it('все пять оценены — «Трекер заполнен — индекс 6,8» (с запятой)', () => {
    const feed = buildTodayFeed([], { filled: 5, total: 5, index: 6.8 });
    expect(feed).toHaveLength(1);
    expect(feed[0].text).toBe('Трекер заполнен — индекс 6,8');
  });

  it('пустой день — пустая лента, без выдуманных строк', () => {
    expect(buildTodayFeed([], { filled: 0, total: 5, index: null })).toEqual([]);
  });
});

describe('мета-строки плиток', () => {
  it('трекер: ничего, часть, всё', () => {
    expect(trackerTileMeta({ filled: 0, total: 5, index: null })).toBe('Ещё не заполнен · ≈1 мин');
    expect(trackerTileMeta({ filled: 2, total: 5, index: null })).toBe('Заполнено 2 из 5 · продолжить');
    expect(trackerTileMeta({ filled: 5, total: 5, index: 7 })).toBe('Готово · индекс 7,0');
  });
  it('трекер: потребности ещё не загрузились — как незаполненный, без «0 из 0»', () => {
    expect(trackerTileMeta({ filled: 0, total: 0, index: null })).toBe('Ещё не заполнен · ≈1 мин');
  });
  it('что случилось: всегда обещание, без счёта разборов', () => {
    expect(caseTileMeta()).toBe('≈3 мин · когда что-то зацепило');
    expect(caseTileMeta(0)).toBe('≈3 мин · когда что-то зацепило');
    expect(caseTileMeta(1)).toBe('Сегодня: 1 разбор');
    expect(caseTileMeta(2)).toBe('Сегодня: 2 разбора');
    expect(caseTileMeta(5)).toBe('Сегодня: 5 разборов');
    expect(caseTileMeta(21)).toBe('Сегодня: 21 разбор');
  });
  it('дневник: грузится — null; сегодня N; последняя; пусто', () => {
    expect(diaryTileMeta(false, 0, null)).toBeNull();
    expect(diaryTileMeta(true, 1, null)).toBe('Сегодня 1 запись');
    expect(diaryTileMeta(true, 3, null)).toBe('Сегодня 3 записи');
    expect(diaryTileMeta(true, 5, null)).toBe('Сегодня 5 записей');
    expect(diaryTileMeta(true, 0, hoursAgo(30))).toBe('Последняя запись — вчера');
    expect(diaryTileMeta(true, 0, null)).toBe('Пока записей нет');
  });
  it('fmtIndex: запятая и один знак', () => {
    expect(fmtIndex(6.84)).toBe('6,8');
    expect(fmtIndex(10)).toBe('10,0');
  });
});

describe('lastEntryAt', () => {
  it('самый поздний момент среди трёх дневников; пусто — null', () => {
    expect(lastEntryAt({ schema: [], mode: [], gratitude: [] })).toBeNull();
    expect(lastEntryAt({
      schema: [{ id: 1, trigger: 'т', createdAt: '2026-10-01T10:00:00Z' }],
      mode: [{ id: 2, situation: 'с', createdAt: '2026-10-03T10:00:00Z' }],
      gratitude: [{ id: 3, items: [], date: '2026-10-02', createdAt: '2026-10-02T10:00:00Z' }],
    })).toBe('2026-10-03T10:00:00Z');
  });
});
