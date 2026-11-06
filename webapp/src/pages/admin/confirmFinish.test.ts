import { describe, it, expect } from 'vitest';
import { needsConfirmFinish } from './confirmFinish';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const FUTURE = '2026-11-07T10:00:00Z';
const PAST = '2026-11-05T10:00:00Z';

describe('needsConfirmFinish — когда в админке «Доделать»', () => {
  it('CONFIRMED с пустым флагом и встречей впереди — да', () => {
    expect(needsConfirmFinish({ status: 'CONFIRMED', startsAt: FUTURE, confirmEffectsDoneAt: null }, NOW)).toBe(true);
  });

  it('эффекты уже доведены — нет', () => {
    expect(needsConfirmFinish({ status: 'CONFIRMED', startsAt: FUTURE, confirmEffectsDoneAt: '2026-11-06T11:00:00Z' }, NOW)).toBe(false);
  });

  it('встреча прошла — нет: ссылка и календарь для прошедшей сессии ни к чему (крон тоже берёт только будущие)', () => {
    expect(needsConfirmFinish({ status: 'CONFIRMED', startsAt: PAST, confirmEffectsDoneAt: null }, NOW)).toBe(false);
  });

  it('HELD, CANCELLED, COMPLETED — нет: у HELD своя кнопка «Подтвердить»', () => {
    for (const status of ['HELD', 'CANCELLED', 'COMPLETED']) {
      expect(needsConfirmFinish({ status, startsAt: FUTURE, confirmEffectsDoneAt: null }, NOW)).toBe(false);
    }
  });

  it('поля нет в ответе (undefined) — нет: иначе кнопка встала бы у каждой подтверждённой записи', () => {
    expect(needsConfirmFinish({ status: 'CONFIRMED', startsAt: FUTURE }, NOW)).toBe(false);
  });
});
