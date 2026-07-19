import type { SchemaScore } from '../../hooks/useYsqTest';

// Общие типы для распиленных подкомпонентов YSQTestSheet.
// Источник правды — парный хук useYsqTest (не дублируем, только реэкспорт).
export type Scores = Record<string, SchemaScore>;

export type {
  SchemaInfo,
  SchemaScore,
  ResultView,
  ResultViewDomain,
  YsqHistoryEntry,
} from '../../hooks/useYsqTest';
