import type { UserId } from '../../userId';
import type { PlanWorkEntry } from './planWork';

/** Ручка «над какими пунктами плана работали»: отдельным модулем — planApi.ts и sharedApi.ts упёрлись в лимит (№10). */
export const createPlanWorkApi = (t: { get<T>(path: string): Promise<T> }) => ({
  /** Записи сессий с отмеченными пунктами плана, свежие первыми. */
  getPlanWork: (clientId: UserId) =>
    t.get<{ entries: PlanWorkEntry[] }>(
      `/api/therapy/notes/${clientId}/plan-work`,
    ),
});
