import type { Prisma, TherapyPath, TherapyPathPhase } from '@prisma/client';
import {
  decryptRecord,
  encryptRecord,
  type EncryptSchema,
} from '../utils/crypto-record';
import type {
  PathPhaseDraft,
  PathPhaseView,
  TherapyPathView,
} from './therapy-path.types';

export const PATH_PHASE_SCHEMA: EncryptSchema = {
  strings: ['name', 'goal', 'note'],
  model: 'TherapyPathPhase',
};

type PathReader = Pick<Prisma.TransactionClient, 'therapyPathPhase'>;

const numbers = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((n): n is number => Number.isInteger(n))
    : [];

function phaseView(row: TherapyPathPhase): PathPhaseView {
  const r = decryptRecord(row, PATH_PHASE_SCHEMA);
  return {
    id: r.id,
    position: r.position,
    name: r.name,
    goal: r.goal,
    weeks: r.weeks,
    templatePhaseId: r.templatePhaseId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    criteriaDone: numbers(r.criteriaDone),
    note: r.note,
  };
}

export function phasesInOrder(db: PathReader, pathId: number) {
  return db.therapyPathPhase.findMany({
    where: { pathId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });
}

// Одна сборка на все ответы: каждая ручка отдаёт путь целиком.
export async function pathView(
  db: PathReader,
  path: TherapyPath,
): Promise<TherapyPathView> {
  const phases = await phasesInOrder(db, path.id);
  return {
    id: path.id,
    clientId: String(path.clientId),
    startDate: path.startDate,
    templateId: path.templateId,
    phases: phases.map(phaseView),
    createdAt: path.createdAt.toISOString(),
    updatedAt: path.updatedAt.toISOString(),
  };
}

/** Строка фазы к записи: текст шифруется. */
export function phaseData(pathId: number, position: number, d: PathPhaseDraft) {
  return encryptRecord(
    {
      pathId,
      position,
      name: d.name,
      goal: d.goal ?? null,
      weeks: d.weeks,
      templatePhaseId: d.templatePhaseId ?? null,
    },
    PATH_PHASE_SCHEMA,
  );
}
