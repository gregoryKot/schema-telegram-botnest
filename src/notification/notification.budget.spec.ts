// Хвост волны 3 (аудит 2026-11): границы местного дня брали смещение полудня,
// а полночь в день перевода часов живёт по другому смещению — день съезжал на
// час. Берлин переводит часы в 01:00 UTC: весной +1 → +2, осенью +2 → +1.
// Моменты здесь — с явным `Z`, поэтому спек не зависит от TZ процесса.
import { localDayBounds } from './notification.budget';
import { utcInstantForLocalHour } from './notification.time';

const BERLIN = 'Europe/Berlin';
const SYDNEY = 'Australia/Sydney';

describe('localDayBounds через переход часов', () => {
  it('весна: день 29 марта длится 23 часа и начинается в 00:00 по зимнему времени', () => {
    const { start, end } = localDayBounds(
      BERLIN,
      new Date('2026-03-29T10:00:00Z'),
    );
    expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('осень: день 25 октября длится 25 часов и начинается в 00:00 по летнему времени', () => {
    const { start, end } = localDayBounds(
      BERLIN,
      new Date('2026-10-25T10:00:00Z'),
    );
    expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it('сообщение в 23:30 местного накануне перевода не попадает в новый день', () => {
    // 22:30 UTC 28 марта = 23:30 CET, ещё 28-е.
    const lateEvening = new Date('2026-03-28T22:30:00Z');
    const { start } = localDayBounds(BERLIN, new Date('2026-03-29T10:00:00Z'));
    expect(lateEvening.getTime()).toBeLessThan(start.getTime());
  });

  it('южное полушарие: Сидней уходит с летнего времени 5 апреля', () => {
    const { start, end } = localDayBounds(
      SYDNEY,
      new Date('2026-04-05T03:00:00Z'),
    );
    expect(start.toISOString()).toBe('2026-04-04T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-04-05T14:00:00.000Z');
  });

  it('обычный день без перевода не меняется', () => {
    const { start, end } = localDayBounds(
      BERLIN,
      new Date('2026-07-02T10:00:00Z'),
    );
    expect(start.toISOString()).toBe('2026-07-01T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-02T22:00:00.000Z');
  });
});

describe('utcInstantForLocalHour: час до перевода берёт своё смещение', () => {
  it('01:00 Берлина 29 марта — ещё зимнее время', () => {
    expect(utcInstantForLocalHour('2026-03-29', 1, BERLIN).toISOString()).toBe(
      '2026-03-29T00:00:00.000Z',
    );
  });

  it('01:00 Берлина 25 октября — ещё летнее время', () => {
    expect(utcInstantForLocalHour('2026-10-25', 1, BERLIN).toISOString()).toBe(
      '2026-10-24T23:00:00.000Z',
    );
  });

  it('час после перевода не сдвигается', () => {
    expect(utcInstantForLocalHour('2026-03-29', 21, BERLIN).toISOString()).toBe(
      '2026-03-29T19:00:00.000Z',
    );
    expect(utcInstantForLocalHour('2026-10-25', 21, BERLIN).toISOString()).toBe(
      '2026-10-25T20:00:00.000Z',
    );
  });
});
