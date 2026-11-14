// Что удалится при слиянии без объединения: только известные категории сервера.
import { describe, it, expect } from 'vitest';
import { lostLines } from './lostText';

describe('lostLines', () => {
  it.each([
    [1, '1 оценка потребностей за те же дни'],
    [2, '2 оценки потребностей за те же дни'],
    [5, '5 оценок потребностей за те же дни'],
    [21, '21 оценка потребностей за те же дни'],
  ])('%i — число и слово согласованы', (n, line) => {
    expect(lostLines({ Rating: n })).toEqual([line]);
  });

  it('порядок фиксированный, не порядок ключей ответа', () => {
    expect(lostLines({ TherapistRequest: 1, YsqProgress: 1, ChildhoodRating: 3, Rating: 2 })).toEqual([
      '2 оценки потребностей за те же дни',
      '3 оценки в колесе детства',
      'незаконченное прохождение теста на схемы',
      'заявка на роль терапевта',
    ]);
  });

  it('неизвестный ключ, 0 и не-число пропускаются: сырые имена таблиц на экран не попадают', () => {
    const odd = { AppActivity: 4, Rating: 0, ChildhoodRating: '2', YsqProgress: -1 } as unknown as Record<string, number>;
    expect(lostLines(odd)).toEqual([]);
  });

  it('пусто или поля нет — []', () => {
    expect(lostLines({})).toEqual([]);
    expect(lostLines(undefined)).toEqual([]);
  });
});
