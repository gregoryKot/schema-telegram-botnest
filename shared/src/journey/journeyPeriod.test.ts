// Фильтр периода ленты «Моего пути» (за всё время / неделя / месяц). Ошибка
// тут — либо чужая запись «просачивается» в короткий период, либо, наоборот,
// свежая запись «ровно на границе» пропадает (пустое состояние на самом деле
// непустого дня). Проверяем именно границы: ровно 7 и ровно 30 дней назад.
import { describe, it, expect } from 'vitest';
import { filterJourneyByPeriod } from './journeyPeriod';

const DAY = 86_400_000;

describe('filterJourneyByPeriod', () => {
  const now = new Date('2026-07-21T12:00:00.000Z');

  it('«all» отдаёт копию входа без фильтрации', () => {
    const items = [{ type: 'note', at: '2020-01-01' }];
    const result = filterJourneyByPeriod(items, 'all', now);
    expect(result).toEqual(items);
    expect(result).not.toBe(items); // не мутирует/не отдаёт ту же ссылку
  });

  it('неделя: запись ровно 7×24ч назад ещё входит (граница включительно)', () => {
    const at = new Date(now.getTime() - 7 * DAY).toISOString();
    expect(
      filterJourneyByPeriod([{ type: 'note', at }], 'week', now),
    ).toHaveLength(1);
  });

  it('неделя: запись на миллисекунду старше границы уже не входит', () => {
    const at = new Date(now.getTime() - 7 * DAY - 1).toISOString();
    expect(filterJourneyByPeriod([{ type: 'note', at }], 'week', now)).toEqual(
      [],
    );
  });

  it('месяц: запись ровно 30×24ч назад ещё входит', () => {
    const at = new Date(now.getTime() - 30 * DAY).toISOString();
    expect(
      filterJourneyByPeriod([{ type: 'note', at }], 'month', now),
    ).toHaveLength(1);
  });

  it('месяц: запись за пределами 30 дней — исключена', () => {
    const at = new Date(now.getTime() - 31 * DAY).toISOString();
    expect(filterJourneyByPeriod([{ type: 'note', at }], 'month', now)).toEqual(
      [],
    );
  });

  it('дата без времени (YYYY-MM-DD) трактуется как полночь того дня', () => {
    // Оба конца сравнения — полночь: 2026-07-14T00:00 ровно 7×24ч назад
    // от 2026-07-21T00:00 → входит в неделю.
    const midnight = new Date('2026-07-21T00:00:00.000Z');
    expect(
      filterJourneyByPeriod(
        [{ type: 'note', at: '2026-07-14' }],
        'week',
        midnight,
      ),
    ).toHaveLength(1);
  });

  it('нечитаемая дата не проходит фильтр (не роняет, не считается свежей)', () => {
    expect(
      filterJourneyByPeriod([{ type: 'note', at: 'мусор' }], 'week', now),
    ).toEqual([]);
  });

  it('пустая лента → пустой результат для любого периода', () => {
    expect(filterJourneyByPeriod([], 'week', now)).toEqual([]);
    expect(filterJourneyByPeriod([], 'month', now)).toEqual([]);
  });
});
