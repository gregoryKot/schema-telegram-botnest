import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  createFakeTable,
  createFakeTransaction,
} from '../test-support/fake-prisma.spec-helper';
import { TherapyPathService } from './therapy-path.service';
import { TherapyPlanService } from './therapy-plan.service';
import { PATH_PHASES_MAX } from './therapy-path.types';

const T = 9n;
const OTHER_T = 10n;
const C1 = 7n;
const C2 = 8n;
const STRANGER = 99n;

function setup() {
  const stamps = () => ({ createdAt: new Date(), updatedAt: new Date() });
  const prisma: Record<string, unknown> = {
    therapyPath: createFakeTable([], { defaults: stamps }),
    therapyPathPhase: createFakeTable([], {
      defaults: () => ({
        goal: null,
        note: null,
        startedAt: null,
        endedAt: null,
        criteriaDone: [],
        ...stamps(),
      }),
    }),
    therapyPlanItem: createFakeTable([], {
      defaults: () => ({
        status: 'planned',
        taskId: null,
        phaseId: null,
        ...stamps(),
      }),
    }),
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
  const service = new TherapyPathService(prisma as never, relations as never);
  const plan = new TherapyPlanService(prisma as never, relations as never);
  return { service, plan, clients };
}

const draft = (name: string, weeks = 4) => ({ name, weeks });
const input = {
  startDate: '2026-11-02',
  templateId: 'general',
  phases: [
    {
      ...draft('Оценка'),
      goal: 'собрать картину',
      templatePhaseId: 'assessment',
    },
    draft('Связь', 12),
    draft('Изменения', 24),
  ],
};
const names = (path: { phases: { name: string }[] } | null) =>
  path?.phases.map((p) => p.name);

describe('TherapyPathService', () => {
  it('создал → нашёл: путь с фазами по порядку', async () => {
    const { service } = setup();
    const created = await service.create(T, C1, input);

    const found = await service.get(T, C1);
    expect(found).toEqual(created);
    expect(found).toMatchObject({
      clientId: '7',
      startDate: '2026-11-02',
      templateId: 'general',
    });
    expect(found?.phases[0]).toMatchObject({
      position: 0,
      name: 'Оценка',
      goal: 'собрать картину',
      weeks: 4,
      templatePhaseId: 'assessment',
      startedAt: null,
      endedAt: null,
      criteriaDone: [],
      note: null,
    });
    expect(names(found)).toEqual(['Оценка', 'Связь', 'Изменения']);
    expect(typeof found?.createdAt).toBe('string');
    expect(await service.get(T, C2)).toBeNull();
  });

  it('путь у пары один: повтор — 409, второго пути нет', async () => {
    const { service } = setup();
    await service.create(T, C1, input);
    await expect(service.create(T, C1, input)).rejects.toThrow(
      ConflictException,
    );
    // Другой терапевт того же клиента ведёт свой путь.
    await service.create(OTHER_T, C1, { ...input, phases: [draft('Своя')] });
    expect(names(await service.get(T, C1))).toHaveLength(3);
  });

  it('чужой клиент: путь не читается, не создаётся и не правится', async () => {
    const { service } = setup();
    const relation = 'No active relation';
    await expect(service.get(T, STRANGER)).rejects.toThrow(relation);
    await expect(service.create(T, STRANGER, input)).rejects.toThrow(relation);
    await expect(service.setStart(T, STRANGER, '2026-12-01')).rejects.toThrow(
      relation,
    );
    await expect(service.remove(T, STRANGER)).rejects.toThrow(relation);
    await expect(service.addPhase(T, STRANGER, draft('Фаза'))).rejects.toThrow(
      relation,
    );
    await expect(service.reorder(T, STRANGER, [1])).rejects.toThrow(relation);
  });

  it('фаза чужого пути и фаза после разрыва связи — 404 для правки, перехода и удаления', async () => {
    const { service, clients } = setup();
    const mine = await service.create(T, C1, input);
    const id = mine.phases[0].id;
    const attempts = (t: bigint) => [
      service.updatePhase(t, id, { name: 'взлом' }),
      service.advance(t, id, '2026-12-01'),
      service.removePhase(t, id),
    ];
    for (const attempt of attempts(OTHER_T))
      await expect(attempt).rejects.toThrow(NotFoundException);
    clients.set(T, [C2]);
    for (const attempt of attempts(T))
      await expect(attempt).rejects.toThrow(NotFoundException);
    clients.set(T, [C1, C2]);
    expect((await service.get(T, C1))?.phases[0]).toMatchObject({
      name: 'Оценка',
      endedAt: null,
    });
  });

  it('правка фазы меняет только присланное; null стирает значение', async () => {
    const { service } = setup();
    const { phases } = await service.create(T, C1, input);
    const id = phases[0].id;
    await service.updatePhase(T, id, {
      note: 'идёт медленно',
      criteriaDone: [0, 2],
      startedAt: '2026-11-03',
    });
    const path = await service.updatePhase(T, id, { goal: null, weeks: 6 });
    expect(path.phases[0]).toMatchObject({
      name: 'Оценка',
      goal: null,
      weeks: 6,
      note: 'идёт медленно',
      criteriaDone: [0, 2],
      startedAt: '2026-11-03',
    });
  });

  it('переход: фаза закрыта днём, следующая по порядку начата тем же днём', async () => {
    const { service } = setup();
    const { phases } = await service.create(T, C1, input);
    const [a, b, c] = phases.map((p) => p.id);
    // «Следующая» — по position, а не по id.
    await service.reorder(T, C1, [a, c, b]);

    const path = await service.advance(T, a, '2026-12-01');
    expect(path.phases.map((p) => [p.id, p.startedAt, p.endedAt])).toEqual([
      [a, null, '2026-12-01'],
      [c, '2026-12-01', null],
      [b, null, null],
    ]);

    // Последняя фаза закрывается одна.
    const last = await service.advance(T, b, '2027-06-01');
    expect(last.phases[2]).toMatchObject({ id: b, endedAt: '2027-06-01' });
    expect(last.phases[1].startedAt).toBe('2026-12-01');
  });

  it('порядок: ids — ровно множество фаз пути, иначе 400 и порядок прежний', async () => {
    const { service } = setup();
    const { phases } = await service.create(T, C1, input);
    const [a, b, c] = phases.map((p) => p.id);
    const foreign = (await service.create(T, C2, input)).phases[0].id;

    for (const ids of [
      [a, b],
      [a, b, foreign],
      [a, b, c, foreign],
    ])
      await expect(service.reorder(T, C1, ids)).rejects.toThrow(
        BadRequestException,
      );
    expect(names(await service.get(T, C1))).toEqual([
      'Оценка',
      'Связь',
      'Изменения',
    ]);
    expect(names(await service.reorder(T, C1, [c, a, b]))).toEqual([
      'Изменения',
      'Оценка',
      'Связь',
    ]);
  });

  it('фаза добавляется в конец; двадцать первая — 400', async () => {
    const { service } = setup();
    await service.create(T, C1, {
      startDate: '2026-11-02',
      phases: Array.from({ length: PATH_PHASES_MAX - 1 }, (_, i) =>
        draft(`Фаза ${i + 1}`),
      ),
    });
    const path = await service.addPhase(T, C1, draft('Последняя'));
    expect(path.phases).toHaveLength(PATH_PHASES_MAX);
    expect(path.phases.at(-1)).toMatchObject({
      name: 'Последняя',
      position: PATH_PHASES_MAX - 1,
    });
    await expect(service.addPhase(T, C1, draft('Лишняя'))).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.addPhase(T, C2, draft('Фаза'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('старт пути правится, удаление фазы и пути; повторное удаление пути — не ошибка', async () => {
    const { service } = setup();
    const { phases } = await service.create(T, C1, input);
    expect((await service.setStart(T, C1, '2026-12-07')).startDate).toBe(
      '2026-12-07',
    );
    expect(names(await service.removePhase(T, phases[1].id))).toEqual([
      'Оценка',
      'Изменения',
    ]);
    await service.remove(T, C1);
    expect(await service.get(T, C1)).toBeNull();
    await expect(service.remove(T, C1)).resolves.toBeUndefined();
  });

  it('пункт плана встаёт только в фазу пути своей пары; null снимает с фазы', async () => {
    const { service, plan } = setup();
    const own = (await service.create(T, C1, input)).phases[0].id;
    const otherClient = (await service.create(T, C2, input)).phases[0].id;
    const otherTherapist = (await service.create(OTHER_T, C1, input)).phases[0]
      .id;
    const [item] = await plan.create(T, [C1], {
      rubric: 'cognitive',
      text: 'проверка убеждений',
    });
    expect(item.phaseId).toBeNull();

    for (const phaseId of [otherClient, otherTherapist, 9999])
      await expect(plan.update(T, item.id, { phaseId })).rejects.toThrow(
        NotFoundException,
      );
    expect((await plan.update(T, item.id, { phaseId: own })).phaseId).toBe(own);
    expect((await plan.list(T, C1))[0].phaseId).toBe(own);
    expect(
      (await plan.update(T, item.id, { phaseId: null })).phaseId,
    ).toBeNull();
  });
});
