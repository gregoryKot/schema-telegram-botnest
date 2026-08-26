import type { SchemaInfo } from './ysqSchemas';
import type { YsqHistoryEntry } from './ysqScoring';

// Контракты теста YSQ: доступ к бэкенду и форма результата для UI.
// Вынесено из useYsqTest.ts (правило №10) — как раньше ключи хранилища;
// хук ре-экспортирует их, поэтому потребители `from './useYsqTest'` не
// заметили переезда.

export interface YsqApi {
  getYsqHistory: () => Promise<YsqHistoryEntry[] | null | undefined>;
  getYsqResult: () => Promise<
    { answers: number[]; completedAt: string } | null | undefined
  >;
  getYsqProgress: () => Promise<
    { answers: number[]; page: number } | null | undefined
  >;
  saveYsqProgress: (answers: number[], page: number) => Promise<unknown>;
  saveYsqResult: (answers: number[]) => Promise<unknown>;
  deleteYsqProgress: () => Promise<unknown>;
  deleteYsqResult: () => Promise<unknown>;
}

export interface UseYsqTestOptions {
  api: YsqApi;
  autoResume?: boolean;
}

export interface ResultViewDomain {
  needId: string;
  label: string;
  schemas: SchemaInfo[];
}

export interface ResultView {
  activeSchemas: SchemaInfo[];
  inactiveSchemas: SchemaInfo[];
  activeByDomain: ResultViewDomain[];
  dateLabel: string | null;
  activeCount: number;
  activeLabel: string;
  getSchemaDelta: (schemaName: string) => number | null;
}
