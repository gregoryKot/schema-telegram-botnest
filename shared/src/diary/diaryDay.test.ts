// День записи дневника — местный день человека (инцидент 2026-10-26:
// благодарность в 00:19 по Москве получала гринвичское 26-е).
import { describe, expect, it } from 'vitest';
import { diaryDayKey, diaryToday, isDiaryToday } from './diaryDay';
import { todayStr } from '../utils/format';
import { momentIsToday } from '../utils/momentDate';
import { forEachTimeZone, withTimeZone } from '../utils/timeZone.test-helpers';

// 00:19 27 октября по Москве = 21:19 26 октября по Гринвичу.
const NIGHT = new Date('2026-10-26T21:19:00Z');

/** Независимый оракул: дата момента в зоне через Intl, а не через Date-геттеры. */
const dayIn = (tz: string, d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

describe('diaryToday — сегодня по местному дню', () => {
  it('00:19 по Москве — уже 27-е, хотя по Гринвичу ещё 26-е', () => {
    withTimeZone('Europe/Moscow', () => {
      expect(diaryToday(NIGHT)).toBe('2026-10-27');
    });
  });

  it('в каждой зоне совпадает с местной датой момента', () => {
    forEachTimeZone((tz) => {
      expect([tz, diaryToday(NIGHT)]).toEqual([tz, dayIn(tz, NIGHT)]);
    });
  });
});

describe('diaryDayKey — день записи', () => {
  it('дата благодарности остаётся собой в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect([tz, diaryDayKey('2026-10-27')]).toEqual([tz, '2026-10-27']);
    });
  });

  it('момент createdAt — местным днём: запись схемы в 00:19 по Москве — 27-е', () => {
    withTimeZone('Europe/Moscow', () => {
      expect(diaryDayKey(NIGHT.toISOString())).toBe('2026-10-27');
    });
  });
});

describe('isDiaryToday', () => {
  it('ночью по Москве сегодня — запись 27-го, а не 26-го', () => {
    withTimeZone('Europe/Moscow', () => {
      expect(isDiaryToday('2026-10-27', NIGHT)).toBe(true);
      expect(isDiaryToday('2026-10-26', NIGHT)).toBe(false);
      expect(isDiaryToday(NIGHT.toISOString(), NIGHT)).toBe(true);
    });
  });

  it('нечитаемая строка — не сегодня', () => {
    expect(isDiaryToday('мусор', NIGHT)).toBe(false);
  });
});

// «Местный сегодня» один на фронты (сведение партии дневника с партией дат,
// QA 2026-10-26): дневник не держит своей копии — тот же ответ, что у
// todayStr/momentIsToday, которыми считают встречи и подписи «Сегодня».
describe('дневник и общий «местный сегодня» — один ответ', () => {
  const values = [
    '2026-10-26',
    '2026-10-27',
    NIGHT.toISOString(),
    '2026-10-27T10:00:00Z',
    'мусор',
  ];

  it('в каждой зоне diaryToday = todayStr, isDiaryToday = momentIsToday', () => {
    forEachTimeZone((tz) => {
      expect([tz, diaryToday(NIGHT)]).toEqual([tz, todayStr(NIGHT)]);
      for (const v of values) {
        expect([tz, v, isDiaryToday(v, NIGHT)]).toEqual([
          tz,
          v,
          momentIsToday(v, NIGHT),
        ]);
      }
    });
  });
});
