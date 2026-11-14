import { pluralRu } from '../../../../shared/src/utils/pluralRu';

// Что сервер удалит при слиянии без объединения (src/auth/merge-lost.ts,
// LOST_ON_CONFLICT): ключ — имя таблицы, на экран — только известные категории.
const LINES: Array<[string, (n: number) => string]> = [
  ['Rating', (n) => `${n} ${pluralRu(n, 'оценка', 'оценки', 'оценок')} потребностей за те же дни`],
  ['ChildhoodRating', (n) => `${n} ${pluralRu(n, 'оценка', 'оценки', 'оценок')} в колесе детства`],
  ['YsqProgress', () => 'незаконченный тест на схемы'],
  ['TherapistRequest', () => 'заявка на роль терапевта'],
];

/** Строки «что удалится» в фиксированном порядке; неизвестное и n ≤ 0 пропускаются. */
export function lostLines(lost: Record<string, number> | undefined): string[] {
  if (!lost || typeof lost !== 'object') return [];
  return LINES.flatMap(([table, line]) => {
    const n = lost[table];
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? [line(n)] : [];
  });
}
