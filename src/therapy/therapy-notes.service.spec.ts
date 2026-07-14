// saveConceptualization — history-версионирование (read-after-write по
// денормализованному history-массиву, аудит 2026-07, 2.3). Перенесено из
// therapy.authz.spec.ts при распиле TherapyService — 2д REMEDIATION_PLAN.
// assertRelation-граница проверяется отдельно в
// therapy-relations.service.spec.ts; здесь используется реальный
// TherapyRelationsService поверх той же фейковой Prisma, чтобы не
// дублировать текст проверки.
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

function makeService(rels: Rel[], conceptRow: any = null) {
  const concept = { row: conceptRow };
  const prisma: any = {
    ...makeRelationPrismaMock(rels),
    clientConceptualization: {
      findUnique: jest.fn(async () => concept.row),
      upsert: jest.fn(async ({ create, update }: any) => {
        concept.row = concept.row
          ? { ...concept.row, ...update }
          : { ...create };
        return concept.row;
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const relationsService = new TherapyRelationsService(prisma, {} as any);
  const service = new TherapyNotesService(prisma, relationsService);
  return { service, prisma, concept };
}

const T1 = 100n; // терапевт-владелец
const T2 = 200n; // чужой терапевт
const CLIENT = 555n;

const activeRel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};

describe('saveConceptualization — history-версионирование', () => {
  it('первое сохранение — history пустой; второе кладёт снапшот прежнего состояния', async () => {
    const { service, concept } = makeService([activeRel]);
    await service.saveConceptualization(T1, Number(CLIENT), {
      goals: 'v1',
    });
    expect(concept.row.history).toEqual([]);

    await service.saveConceptualization(T1, Number(CLIENT), {
      goals: 'v2',
    });
    expect(concept.row.history).toHaveLength(1);
    expect(concept.row.history[0].goals).toBe('v1');
    expect(concept.row.goals).toBe('v2');
  });

  it('history не растёт бесконечно — потолок 20 снапшотов', async () => {
    const full = Array.from({ length: 20 }, (_, i) => ({
      savedAt: `t${i}`,
      goals: `old${i}`,
    }));
    const { service, concept } = makeService([activeRel], {
      therapistId: T1,
      clientId: CLIENT,
      goals: 'current',
      history: full,
    });
    await service.saveConceptualization(T1, Number(CLIENT), { goals: 'new' });
    expect(concept.row.history).toHaveLength(20);
    expect(concept.row.history[0].goals).toBe('current'); // свежий снапшот вытеснил самый старый
    expect(concept.row.history.at(-1).goals).toBe('old18');
  });

  it('чужой терапевт не может писать конспектуализацию', async () => {
    const { service } = makeService([activeRel]);
    await expect(
      service.saveConceptualization(T2, Number(CLIENT), { goals: 'x' }),
    ).rejects.toThrow('No active relation');
  });
});
