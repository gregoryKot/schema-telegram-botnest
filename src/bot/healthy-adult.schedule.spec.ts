import { dueSlot, plannedOffset, mskParts } from './healthy-adult.schedule';

// Момент по МСК → UTC Date (МСК = UTC+3). Напр. msk(10, 30) на 2026-07-20.
const msk = (hour: number, minute: number, day = 20): Date =>
  new Date(Date.UTC(2026, 6, day, hour - 3, minute));

describe('mskParts', () => {
  it('раскладывает UTC-момент по московскому времени (+3)', () => {
    const p = mskParts(new Date(Date.UTC(2026, 6, 20, 7, 15))); // 10:15 МСК
    expect(p).toEqual({ hour: 10, minute: 15, dateKey: '2026-07-20' });
  });

  it('переход через полночь МСК меняет дату', () => {
    // 22:30 UTC = 01:30 МСК следующего дня
    const p = mskParts(new Date(Date.UTC(2026, 6, 20, 22, 30)));
    expect(p.dateKey).toBe('2026-07-21');
    expect(p.hour).toBe(1);
  });
});

describe('plannedOffset', () => {
  it('всегда внутри окна [0, 116)', () => {
    for (const day of [1, 15, 20, 28]) {
      for (const slot of ['morning', 'evening'] as const) {
        const o = plannedOffset(`2026-07-${String(day).padStart(2, '0')}`, slot);
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThan(116);
      }
    }
  });

  it('детерминирована — тот же день/слот даёт ту же минуту (переживает рестарт)', () => {
    expect(plannedOffset('2026-07-20', 'morning')).toBe(
      plannedOffset('2026-07-20', 'morning'),
    );
  });

  it('утро и вечер одного дня расходятся (не публикуем в одну минуту)', () => {
    expect(plannedOffset('2026-07-20', 'morning')).not.toBe(
      plannedOffset('2026-07-20', 'evening'),
    );
  });

  it('гуляет ото дня ко дню — не выглядит ботом', () => {
    const days = Array.from({ length: 14 }, (_, i) =>
      plannedOffset(`2026-07-${String(i + 1).padStart(2, '0')}`, 'morning'),
    );
    // Хотя бы несколько разных значений за две недели.
    expect(new Set(days).size).toBeGreaterThan(5);
  });
});

describe('dueSlot', () => {
  const plannedMorning = plannedOffset('2026-07-20', 'morning'); // минут от 09:00

  it('вне окон (день) — null', () => {
    expect(dueSlot(msk(13, 0), null)).toBeNull();
  });

  it('в окне, но раньше запланированной минуты — null', () => {
    const before = msk(9, Math.max(0, plannedMorning - 5));
    // если planned=0, «раньше» не существует — тогда пропускаем проверку
    if (plannedMorning > 0) expect(dueSlot(before, null)).toBeNull();
  });

  it('в окне и запланированная минута наступила — возвращает слот', () => {
    const at = msk(9 + Math.floor(plannedMorning / 60), plannedMorning % 60);
    expect(dueSlot(at, null)).toBe('morning');
  });

  it('уже постили в этот слот сегодня — null (нет дубля)', () => {
    const at = msk(9 + Math.floor(plannedMorning / 60), plannedMorning % 60);
    const postedEarlier = msk(9, plannedMorning % 60); // тот же слот, тот же день
    expect(dueSlot(at, postedEarlier)).toBeNull();
  });

  it('вчерашний пост в том же слоте не блокирует сегодняшний', () => {
    const at = msk(9 + Math.floor(plannedMorning / 60), plannedMorning % 60);
    const yesterday = msk(10, 30, 19); // 19 июля
    expect(dueSlot(at, yesterday)).toBe('morning');
  });

  it('ручной пост утром не блокирует вечерний слот', () => {
    const evPlanned = plannedOffset('2026-07-20', 'evening');
    const at = msk(18 + Math.floor(evPlanned / 60), evPlanned % 60);
    const morningPost = msk(10, 0); // утром постили — вечер должен идти
    expect(dueSlot(at, morningPost)).toBe('evening');
  });

  it('в самом конце окна (10:55) публикует, если ещё не постили', () => {
    // Гарантированно >= planned, т.к. planned < 116, а 10:55 = offset 115.
    expect(dueSlot(msk(10, 55), null)).toBe('morning');
  });
});
