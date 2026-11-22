// Ручки плана работы с клиентом (#1337, терапевт): отдельным модулем — api.ts и sharedApi.ts упёрлись в лимит (№10).
import type { UserId } from '../../userId';
import type { PlanItem, PlanRubric, PlanStatus } from './planItem';

interface PlanTransport {
  get<T>(path: string): Promise<T>;
  postJson<T>(path: string, body: unknown): Promise<T>;
  patchJson<T>(path: string, body: unknown): Promise<T>;
  del(path: string): Promise<void>;
}

export interface PlanItemPatch {
  text?: string;
  status?: PlanStatus;
  rubric?: PlanRubric;
  taskId?: number | null;
  phaseId?: number | null; // null — вне фаз
}

const BASE = '/api/therapy/plan';

export const createPlanApi = (t: PlanTransport) => ({
  getTherapyPlan: (clientId: UserId) =>
    t.get<PlanItem[]>(`${BASE}/${clientId}`),
  /** По пункту на каждого клиента; новый встаёт в конец плана. */
  createPlanItems: (body: {
    clientIds: string[];
    rubric: PlanRubric;
    text: string;
    /** Адрес раздела справочника, из которого взят пункт. */
    sourceAddress?: string;
  }) => t.postJson<{ items: PlanItem[] }>(BASE, body),
  updatePlanItem: (id: number, body: PlanItemPatch) =>
    t.patchJson<PlanItem>(`${BASE}/items/${id}`, body),
  deletePlanItem: (id: number) => t.del(`${BASE}/items/${id}`),
  /** Новый порядок плана: все id пунктов клиента; неполный список сервер отвергает (404). */
  reorderPlan: (clientId: UserId, ids: number[]) =>
    t.postJson<{ ok: true }>(`${BASE}/order/${clientId}`, { ids }),
});

export type PlanApi = ReturnType<typeof createPlanApi>;
