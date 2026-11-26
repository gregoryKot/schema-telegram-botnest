// Что удалится при слиянии без объединения: только известные категории сервера.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lostLines } from './lostText';

// Сверка с src/auth/merge-lost.ts (правило №4): сайт не импортирует бэкендовый модуль.
const server = readFileSync(resolve(__dirname, '../../../../src/auth/merge-lost.ts'), 'utf8');
const keysOf = (name: string): string[] => {
  const body = server.match(new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
};

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
      'незаконченный тест на схемы',
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

  it('сверка с сервером: каждая таблица LOST_ON_CONFLICT — своя строка, LOST_UNSHOWN — ни одной', () => {
    const shown = keysOf('LOST_ON_CONFLICT');
    const unshown = keysOf('LOST_UNSHOWN');
    expect(shown.length).toBeGreaterThan(0);
    expect(unshown.length).toBeGreaterThan(0);
    for (const table of shown) expect(lostLines({ [table]: 1 }), table).toHaveLength(1);
    expect(lostLines(Object.fromEntries(unshown.map((t) => [t, 1])))).toEqual([]);
  });
});
