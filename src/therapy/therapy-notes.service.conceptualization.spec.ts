// Покрывает getConceptualization (пусто/непусто, decrypt истории) и ветки
// saveConceptualization для schemaIds/modeIds/modeMapNodes/modeMapEdges —
// history-версионирование текстовых полей уже покрыто в
// therapy-notes.service.spec.ts, здесь — массивы, которые до этого теста
// шли отдельным (непокрытым) путём в encryptConceptFields/decryptConceptFields.
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

const T1 = 100n;
const T2 = 200n;
const CLIENT = 555n;

const activeRel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};

describe('TherapyNotesService.getConceptualization', () => {
  it('возвращает null, когда концептуализации ещё нет', async () => {
    const { service } = makeService([activeRel]);
    await expect(
      service.getConceptualization(T1, Number(CLIENT)),
    ).resolves.toBeNull();
  });

  it('чужой терапевт не может прочитать концептуализацию', async () => {
    const { service } = makeService([activeRel]);
    await expect(
      service.getConceptualization(T2, Number(CLIENT)),
    ).rejects.toThrow('No active relation');
  });

  it('сохранённая концептуализация читается назад теми же значениями массивов и текста (read-after-write)', async () => {
    const { service } = makeService([activeRel]);
    await service.saveConceptualization(T1, Number(CLIENT), {
      schemaIds: ['defectiveness', 'abandonment'],
      modeIds: ['vulnerable_child'],
      modeMapNodes: [{ id: 'n1', label: 'Уязвимый ребёнок' }],
      modeMapEdges: [{ from: 'n1', to: 'n2' }],
      goals: 'снизить избегание',
    });

    const loaded = await service.getConceptualization(T1, Number(CLIENT));
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaIds).toEqual(['defectiveness', 'abandonment']);
    expect(loaded!.modeIds).toEqual(['vulnerable_child']);
    expect(loaded!.modeMapNodes).toEqual([
      { id: 'n1', label: 'Уязвимый ребёнок' },
    ]);
    expect(loaded!.modeMapEdges).toEqual([{ from: 'n1', to: 'n2' }]);
    expect(loaded!.goals).toBe('снизить избегание');
    expect(loaded!.history).toEqual([]);
  });

  it('history возвращается расшифрованным по каждому снапшоту', async () => {
    const { service } = makeService([activeRel]);
    await service.saveConceptualization(T1, Number(CLIENT), {
      schemaIds: ['defectiveness'],
      goals: 'v1',
    });
    await service.saveConceptualization(T1, Number(CLIENT), { goals: 'v2' });

    const loaded = await service.getConceptualization(T1, Number(CLIENT));
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.history[0].goals).toBe('v1');
    expect(loaded!.history[0].schemaIds).toEqual(['defectiveness']);
  });
});
