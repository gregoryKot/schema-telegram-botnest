// Прошедшая nextSession не должна жить «следующей сессией»: при днях встреч
// она переезжает на ближайший такой день с тем же временем.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isSessionToday, upcomingSession } from './upcomingSession';
import { forEachTimeZone, withTimeZone } from '../utils/timeZone.test-helpers';

// 2026-10-26 — понедельник, 2026-10-17 и 2026-10-31 — субботы.
const TODAY = '2026-10-26';
const SAT = 6;

describe('upcomingSession', () => {
  it('будущая и сегодняшняя дата остаются как есть, даже при днях встреч', () => {
    expect(upcomingSession('2026-11-04T10:00', [SAT], TODAY)).toBe(
      '2026-11-04T10:00',
    );
    expect(upcomingSession('2026-10-26T07:00', [SAT], TODAY)).toBe(
      '2026-10-26T07:00',
    );
  });

  it('прошедшая дата при еженедельной субботе — ближайшая суббота с тем же временем', () => {
    expect(upcomingSession('2026-10-17T07:00', [SAT], TODAY)).toBe(
      '2026-10-31T07:00',
    );
  });

  it('берёт ближайший из нескольких дней; сегодняшний день встреч — сегодня', () => {
    expect(upcomingSession('2026-10-17T07:00', [SAT, 3], TODAY)).toBe(
      '2026-10-28T07:00',
    );
    expect(upcomingSession('2026-10-17T07:00', [1], TODAY)).toBe(
      '2026-10-26T07:00',
    );
  });

  it('без сохранённой даты — ближайший день встреч без времени', () => {
    expect(upcomingSession(null, [SAT], TODAY)).toBe('2026-10-31');
  });

  it('прошедшая дата без дней встреч и пустые данные — null', () => {
    expect(upcomingSession('2026-10-17T07:00', [], TODAY)).toBeNull();
    expect(upcomingSession('2026-10-17', null, TODAY)).toBeNull();
    expect(upcomingSession(null, undefined, TODAY)).toBeNull();
  });

  it('день недели не зависит от зоны машины', () => {
    forEachTimeZone((tz) => {
      expect(upcomingSession('2026-10-17T07:00', [SAT], TODAY), tz).toBe(
        '2026-10-31T07:00',
      );
    });
  });
});

// QA 2026-10-26 (00:00–00:25 по Москве = 21:xx UTC): «сегодня» по умолчанию
// было днём UTC. После полуночи по Москве вчерашняя встреча 23:00 считалась
// предстоящей, а сегодняшняя 15:00 пропадала из «Сессий сегодня»; во
// Владивостоке так до 10:00 каждый день. nextSession — настенное время
// терапевта, сравнивается с МЕСТНЫМ днём смотрящего.
describe('upcomingSession / isSessionToday — сегодня по местному дню', () => {
  afterEach(() => vi.useRealTimers());
  // 2026-10-26T21:10Z: в Москве уже 27-е 00:10, во Владивостоке 27-е 07:10,
  // в Лос-Анджелесе ещё 26-е 14:10.
  const at2110Z = <T>(tz: string, fn: () => T): T =>
    withTimeZone(tz, () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T21:10:00Z'));
      return fn();
    });

  it('в 00:10 по Москве вчерашняя 23:00 — прошла, сегодняшняя 15:00 — сегодня', () => {
    for (const tz of ['Europe/Moscow', 'Asia/Vladivostok']) {
      at2110Z(tz, () => {
        expect(upcomingSession('2026-10-26T23:00', []), tz).toBeNull();
        expect(isSessionToday('2026-10-26T23:00'), tz).toBe(false);
        expect(upcomingSession('2026-10-27T15:00', []), tz).toBe(
          '2026-10-27T15:00',
        );
        expect(isSessionToday('2026-10-27T15:00'), tz).toBe(true);
      });
    }
  });

  it('западнее Гринвича в тот же момент ещё 26-е — 23:00 сегодня', () => {
    at2110Z('America/Los_Angeles', () => {
      expect(upcomingSession('2026-10-26T23:00', [])).toBe('2026-10-26T23:00');
      expect(isSessionToday('2026-10-26T23:00')).toBe(true);
      expect(isSessionToday('2026-10-27T15:00')).toBe(false);
    });
  });

  it('дни встреч переносятся от местного дня: вторник в Москве уже сегодня', () => {
    // 27.10.2026 — вторник (2). Прошедшая дата → ближайший вторник.
    at2110Z('Europe/Moscow', () => {
      expect(upcomingSession('2026-10-20T10:00', [2])).toBe('2026-10-27T10:00');
    });
    at2110Z('America/Los_Angeles', () => {
      expect(upcomingSession('2026-10-20T10:00', [2])).toBe('2026-10-27T10:00');
      expect(upcomingSession('2026-10-20T10:00', [1])).toBe('2026-10-26T10:00');
    });
  });

  it('isSessionToday: пусто — не сегодня; явный today сравнивается со строкой дня', () => {
    expect(isSessionToday(null)).toBe(false);
    expect(isSessionToday('', '2026-10-27')).toBe(false);
    expect(isSessionToday('2026-10-27', '2026-10-27')).toBe(true);
    expect(isSessionToday('2026-10-27T09:00', '2026-10-28')).toBe(false);
  });
});
