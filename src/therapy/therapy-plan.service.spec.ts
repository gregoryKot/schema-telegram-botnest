import { NotFoundException } from '@nestjs/common';
import {
  createFakeTable,
  createFakeTransaction,
} from '../test-support/fake-prisma.spec-helper';
import { TherapyPlanService } from './therapy-plan.service';

const T = 9n;
const OTHER_T = 10n;
const C1 = 7n;
const C2 = 8n;
const STRANGER = 99n;

function setup() {
  const prisma: Record<string, unknown> = {
    therapyPlanItem: createFakeTable([], {
      defaults: () => ({
        status: 'planned',
        taskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }),
    userTask: createFakeTable([
      { id: 1, userId: C1, assignedBy: T },
      { id: 2, userId: C2, assignedBy: T },
      { id: 3, userId: C1, assignedBy: OTHER_T },
    ]),
  };
  prisma.$transaction = createFakeTransaction(prisma);
  // Связи: T ведёт C1 и C2, OTHER_T — только C1.
  const clients = new Map([
    [T, [C1, C2]],
    [OTHER_T, [C1]],
  ]);
  const relations = {
    assertHasClient: async (t: bigint, c: bigint) => {
      if (!clients.get(t)?.includes(c)) throw new Error('No active relation');
    },
  };
  const service = new TherapyPlanService(prisma as never, relations as never);
  return { service, clients };
}

const item = { rubric: 'cognitive', text: 'проверка убеждений' };

describe('TherapyPlanService', () => {
  it('создал нескольким клиентам → каждый список отдаёт свой пункт открытым текстом', async () => {
    const { service } = setup();
    const source = { kind: 'schema', id: 'abandonment', field: 'cognitive' };
    const created = await service.create(T, [C1, C2], { ...item, source });

    expect(created.map((i) => i.clientId)).toEqual(['7', '8']);
    for (const cid of [C1, C2]) {
      const list = await service.list(T, cid);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        ...item,
        status: 'planned',
        position: 0,
        source,
        taskId: null,
      });
    }
  });

  it('чужой клиент в списке — отказ всем, ни одной строки не создано', async () => {
    const { service } = setup();
    await expect(service.create(T, [C1, STRANGER], item)).rejects.toThrow(
      'No active relation',
    );
    expect(await service.list(T, C1)).toEqual([]);
  });

  it('новый пункт встаёт в конец, порядок меняется целым списком', async () => {
    const { service } = setup();
    const ids: number[] = [];
    for (const text of ['а', 'б', 'в']) {
      ids.push(
        (await service.create(T, [C1], { rubric: 'custom', text }))[0].id,
      );
    }
    expect((await service.list(T, C1)).map((i) => i.position)).toEqual([
      0, 1, 2,
    ]);

    await service.reorder(T, C1, [ids[2], ids[0], ids[1]]);
    expect((await service.list(T, C1)).map((i) => i.text)).toEqual([
      'в',
      'а',
      'б',
    ]);

    // Неполный список и чужой id порядок не трогают.
    await expect(service.reorder(T, C1, [ids[0]])).rejects.toThrow(
      NotFoundException,
    );
    const [foreign] = await service.create(T, [C2], item);
    await expect(
      service.reorder(T, C1, [ids[0], ids[1], foreign.id]),
    ).rejects.toThrow(NotFoundException);
  });

  it('правка меняет только присланное и отдаёт ту же форму, что список', async () => {
    const { service } = setup();
    const [created] = await service.create(T, [C1], item);
    const updated = await service.update(T, created.id, {
      text: 'новый текст',
      status: 'active',
    });
    expect(updated).toMatchObject({
      text: 'новый текст',
      status: 'active',
      rubric: 'cognitive',
    });
    expect((await service.list(T, C1))[0]).toEqual(updated);
  });

  it('отметка «выдано заданием» — только задание этого терапевта этому клиенту', async () => {
    const { service } = setup();
    const [created] = await service.create(T, [C1], item);
    // 2 — задание другому клиенту, 3 — задание другого терапевта.
    for (const taskId of [2, 3, 404]) {
      await expect(service.update(T, created.id, { taskId })).rejects.toThrow(
        NotFoundException,
      );
    }
    expect((await service.update(T, created.id, { taskId: 1 })).taskId).toBe(1);
    expect(
      (await service.update(T, created.id, { taskId: null })).taskId,
    ).toBeNull();
  });

  it('чужой терапевт не читает, не правит и не удаляет пункт, даже ведя того же клиента', async () => {
    const { service } = setup();
    const [created] = await service.create(T, [C1], item);
    expect(await service.list(OTHER_T, C1)).toEqual([]);
    await expect(
      service.update(OTHER_T, created.id, { status: 'done' }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove(OTHER_T, created.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(await service.list(T, C1)).toHaveLength(1);
  });

  it('после разрыва связи пункт не читается, не правится и не удаляется', async () => {
    const { service, clients } = setup();
    const [created] = await service.create(T, [C1], item);
    clients.set(T, [C2]);
    await expect(service.list(T, C1)).rejects.toThrow('No active relation');
    await expect(
      service.update(T, created.id, { status: 'done' }),
    ).rejects.toThrow('No active relation');
    await expect(service.remove(T, created.id)).rejects.toThrow(
      'No active relation',
    );
  });

  it('удаление убирает пункт из списка', async () => {
    const { service } = setup();
    const [created] = await service.create(T, [C1], item);
    await service.remove(T, created.id);
    expect(await service.list(T, C1)).toEqual([]);
  });
});
