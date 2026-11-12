// Логика записи клиента из приложения (#546): ближайшая бронь, её статус,
// исход «Записаться». Время — в зоне смотрящего, проверяется во всех зонах.
import { describe, it, expect } from 'vitest';
import { bookOutcome, bookingStatusNote, nextBooking, sessionWhen, leadAndRest } from './clientBookingModel';
import type { ClientBookingView } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

const view = (over: Partial<ClientBookingView> = {}): ClientBookingView => ({
  startsAt: '2026-11-10T13:00:00.000Z',
  durationMin: 50,
  status: 'CONFIRMED',
  heldUntil: null,
  manageUrl: 'https://kotlarewski.gr/booking/manage?token=t',
  ...over,
});

describe('nextBooking', () => {
  it('нет броней (или ответа ещё нет) — null, а не выдуманная встреча', () => {
    expect(nextBooking(undefined)).toBeNull();
    expect(nextBooking(null)).toBeNull();
    expect(nextBooking([])).toBeNull();
  });

  it('берёт первую — сервер отдаёт ближайшие по возрастанию', () => {
    const first = view();
    expect(nextBooking([first, view({ startsAt: '2026-11-17T13:00:00.000Z' })])).toBe(first);
  });
});

describe('sessionWhen', () => {
  const NOW = new Date('2026-11-09T09:00:00Z'); // понедельник

  it('«Завтра, 16:00» по Москве и своё время в другой зоне — независимо от зоны машины', () => {
    forEachTimeZone((machine) => {
      expect(sessionWhen('2026-11-10T13:00:00.000Z', 'Europe/Moscow', NOW), machine).toBe('Завтра, 16:00');
      expect(sessionWhen('2026-11-10T13:00:00.000Z', 'Asia/Bangkok', NOW), machine).toBe('Завтра, 20:00');
    });
  });
});

describe('bookingStatusNote', () => {
  it('подтверждена', () => {
    expect(bookingStatusNote(view(), 'Europe/Moscow')).toBe('Запись подтверждена');
  });

  it('ждёт оплаты — до какого времени держится слот, в зоне смотрящего', () => {
    const held = view({ status: 'HELD', heldUntil: '2026-11-09T09:15:00.000Z' });
    expect(bookingStatusNote(held, 'Europe/Moscow')).toBe('Ждёт оплаты до 12:15, потом время освободится');
    expect(bookingStatusNote({ ...held, heldUntil: null }, 'Europe/Moscow')).toBe('Ждёт оплаты');
  });
});

describe('bookOutcome', () => {
  it('ссылка на оплату — к оплате; без неё — запись подтверждена', () => {
    expect(bookOutcome({ paymentUrl: 'https://auth.robokassa.ru/x' })).toBe('pay');
    expect(bookOutcome({ paymentUrl: null })).toBe('done');
  });
});

describe('leadAndRest — фраза сбоя на заголовок и продолжение', () => {
  it.each([
    ['Расписание не загрузилось. Закрой и открой запись ещё раз чуть позже.', 'Расписание не загрузилось.', 'Закрой и открой запись ещё раз чуть позже.'],
    ['Запись не сохранилась: сбой на нашей стороне. Напиши терапевту.', 'Запись не сохранилась:', 'сбой на нашей стороне. Напиши терапевту.'],
    ['Это время только что заняли — выбери другое.', 'Это время только что заняли — выбери другое.', ''],
  ])('%s', (text, lead, rest) => {
    expect(leadAndRest(text)).toEqual([lead, rest]);
    expect([lead, rest].filter(Boolean).join(' ')).toBe(text);
  });
});
