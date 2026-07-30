// Тесты разбора записи теста на схемы для карточки «Моего пути»: профиль всех
// 20 схем рисуется только когда в записи есть средние баллы. У совсем старых
// записей их нет — карточка не должна показывать двадцать прочерков.
import { describe, it, expect } from 'vitest';
import { ysqResultFromEntry } from './journeyParts';
import { historyScoresByName } from '../hooks/ysqScoring';

const entry = (scores: { id: string; pct5plus: number; avg?: number }[]) => ({
  id: 1,
  completedAt: '2026-07-23',
  scores,
});

describe('ysqResultFromEntry', () => {
  it('запись со средними баллами превращается в счёт по названиям схем', () => {
    const res = ysqResultFromEntry(
      entry([
        { id: 'Покорность', pct5plus: 60, avg: 4.5 },
        { id: 'Неуспешность', pct5plus: 10, avg: 2 },
      ]),
    );
    expect(res).not.toBeNull();
    expect(res?.scores['Покорность']).toEqual({ pct5plus: 60, avg: 4.5 });
    expect(res?.activeCount).toBe(1);
  });

  it('старая запись без средних баллов — null (останется текстовая карточка)', () => {
    expect(
      ysqResultFromEntry(
        entry([
          { id: 'Покорность', pct5plus: 60 },
          { id: 'Неуспешность', pct5plus: 80 },
        ]),
      ),
    ).toBeNull();
  });

  it('пустой счёт, не тот объект и мусор — тоже null', () => {
    expect(ysqResultFromEntry(entry([]))).toBeNull();
    expect(ysqResultFromEntry({ scores: 'мусор' })).toBeNull();
    expect(ysqResultFromEntry(null)).toBeNull();
    expect(ysqResultFromEntry(undefined)).toBeNull();
  });

  it('нулевой средний балл не считается за данные', () => {
    expect(
      ysqResultFromEntry(entry([{ id: 'Покорность', pct5plus: 0, avg: 0 }])),
    ).toBeNull();
  });
});

describe('historyScoresByName', () => {
  it('ключ — название схемы, отсутствующий avg становится нулём', () => {
    const byName = historyScoresByName(
      entry([
        { id: 'Уязвимость', pct5plus: 30, avg: 3.2 },
        { id: 'Покорность', pct5plus: 70 },
      ]),
    );
    expect(byName).toEqual({
      Уязвимость: { pct5plus: 30, avg: 3.2 },
      Покорность: { pct5plus: 70, avg: 0 },
    });
  });
});
