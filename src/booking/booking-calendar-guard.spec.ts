// Второй рубеж против записи поверх личного события владельца (аудит 2026-10,
// docs/open/audit-2026-10.md «Запись поверх личного события…»): при
// CALENDAR_BLOCK_SLOTS=true POST book сверяется с занятостью календаря, а не
// только с бронями. Fail-open — решение: календарь упал или молчит дольше
// таймаута — запись проходит с warn в лог, воронка не зависит от iCloud.
import { ConflictException, Logger } from '@nestjs/common';
import {
  assertCalendarFree,
  calendarGuard,
  CALENDAR_CHECK_TIMEOUT_MS,
} from './booking-calendar-guard';

const START = new Date('2026-11-20T10:00:00Z');
const SLOT = { startsAt: START, durationMin: 50 };
const at = (iso: string) => new Date(iso);

function logger() {
  const l = new Logger('test');
  const warn = jest.spyOn(l, 'warn').mockImplementation(() => undefined);
  return { l, warn };
}

describe('assertCalendarFree', () => {
  it('слот пересекает событие календаря — 409 с тем же текстом, что «время заняли»', async () => {
    const cal = {
      getBusyTimes: jest.fn(async () => [
        { start: at('2026-11-20T10:30:00Z'), end: at('2026-11-20T11:30:00Z') },
      ]),
    };
    const { l } = logger();
    const err = await assertCalendarFree(cal, SLOT, l).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).message).toBe('Slot already taken');
    // Окно запроса — ровно слот: кэш занятости нарежет его из широкого окна.
    expect(cal.getBusyTimes).toHaveBeenCalledWith(
      START,
      at('2026-11-20T10:50:00Z'),
    );
  });

  it('событие встык (кончилось к началу слота) — запись проходит', async () => {
    const cal = {
      getBusyTimes: jest.fn(async () => [
        { start: at('2026-11-20T09:00:00Z'), end: START },
      ]),
    };
    await expect(
      assertCalendarFree(cal, SLOT, logger().l),
    ).resolves.toBeUndefined();
  });

  it('календарь упал — запись проходит, warn в лог', async () => {
    const cal = {
      getBusyTimes: jest.fn(async () => {
        throw new Error('fetch failed');
      }),
    };
    const { l, warn } = logger();
    await expect(assertCalendarFree(cal, SLOT, l)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('booking proceeds: fetch failed'),
    );
  });

  it('календарь молчит дольше таймаута — запись проходит, не ждёт iCloud', async () => {
    jest.useFakeTimers();
    try {
      const cal = { getBusyTimes: jest.fn(() => new Promise<never>(() => {})) };
      const { l, warn } = logger();
      const p = assertCalendarFree(cal, SLOT, l);
      await jest.advanceTimersByTimeAsync(CALENDAR_CHECK_TIMEOUT_MS);
      await expect(p).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`timeout ${CALENDAR_CHECK_TIMEOUT_MS} ms`),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

it('assertCalendarFree без источника (флаг выключен) — ничего не делает', async () => {
  await expect(
    assertCalendarFree(undefined, SLOT, logger().l),
  ).resolves.toBeUndefined();
});

describe('calendarGuard — второй рубеж только при CALENDAR_BLOCK_SLOTS=true', () => {
  const calDav = { getBusyTimes: jest.fn(async () => []) };
  const cfg = (v?: string) => ({ get: () => v });

  it('флаг включён — источник занятости тот же сервис календаря', () => {
    expect(calendarGuard(cfg('true'), calDav)).toBe(calDav);
  });

  it.each([[undefined], ['false'], ['1']])('флаг %s — проверки нет', (v) => {
    expect(calendarGuard(cfg(v), calDav)).toBeUndefined();
  });

  it('сервиса календаря нет (тесты, урезанный модуль) — проверки нет', () => {
    expect(calendarGuard(cfg('true'), undefined)).toBeUndefined();
  });
});
