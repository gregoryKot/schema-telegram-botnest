import type { TherapyPlanItem } from '@prisma/client';
import { decryptRecord, type EncryptSchema } from '../utils/crypto-record';
import type { PlanItemView } from './therapy-plan.types';

export const PLAN_SCHEMA: EncryptSchema = {
  strings: ['text'],
  model: 'TherapyPlanItem',
};

// Одна расшифровка на все ответы: список, создание и правка отдают одну форму.
export function toView(row: TherapyPlanItem): PlanItemView {
  const r = decryptRecord(row, PLAN_SCHEMA);
  return {
    id: r.id,
    clientId: String(r.clientId),
    rubric: r.rubric,
    text: r.text,
    status: r.status,
    position: r.position,
    sourceAddress: r.sourceAddress,
    source:
      r.sourceKind && r.sourceId && r.sourceField
        ? { kind: r.sourceKind, id: r.sourceId, field: r.sourceField }
        : null,
    taskId: r.taskId,
    phaseId: r.phaseId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
