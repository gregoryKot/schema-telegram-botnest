// Тесты на TherapyTasksViewService (не покрыт ранее): терапевтский обзор
// задач по всем/одному клиенту. Фокус — двусторонний ownership: терапевт
// видит только СВОИХ клиентов (активная TherapyRelation) и только задачи,
// которые НАЗНАЧИЛ САМ (assignedBy: therapistId) — даже если у клиента есть
// задачи от другого терапевта. В отличие от mode-maps.service.ts, здесь
// проверка активности связи происходит на каждом обращении, а не только
// при листинге — контраст зафиксирован в отчёте.
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { encrypt } from '../utils/crypto';

function matchWhere(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([k, v]) => {
    if (v === undefined) return true;
    const val = row[k];
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      if ('gte' in v) return val >= v.gte;
      if ('lt' in v) return val < v.lt;
      if ('in' in v) return v.in.includes(val);
    }
    return val === v;
  });
}

function makeDb() {
  const relations: any[] = [];
  const tasks: any[] = [];
  const users: any[] = [];
  const ratings: any[] = [];
  const schemaDiary: any[] = [];
  const modeDiary: any[] = [];
  const gratitudeDiary: any[] = [];
  const db: any = {
    therapyRelation: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          relations
            .filter((r) => matchWhere(r, where))
            .map((r) => ({
              ...r,
              client: r.clientId
                ? { id: r.clientId, firstName: r.clientName ?? null }
                : null,
            })),
        ),
      ),
      findFirst: jest.fn(({ where }: any) =>
        Promise.resolve(relations.find((r) => matchWhere(r, where)) ?? null),
      ),
    },
    userTask: {
      findMany: jest.fn(({ where, orderBy }: any) => {
        let rows = tasks.filter((t) => matchWhere(t, where));
        if (orderBy?.createdAt === 'desc')
          rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
        return Promise.resolve(rows);
      }),
    },
    user: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(users.find((u) => u.id === where.id) ?? null),
      ),
    },
    rating: {
      count: jest.fn(({ where }: any) =>
        Promise.resolve(ratings.filter((r) => matchWhere(r, where)).length),
      ),
      groupBy: jest.fn(({ where }: any) => {
        const dates = new Set(
          ratings.filter((r) => matchWhere(r, where)).map((r) => r.date),
        );
        return Promise.resolve(Array.from(dates).map((date) => ({ date })));
      }),
    },
    schemaDiaryEntry: {
      count: jest.fn(({ where }: any) =>
        Promise.resolve(schemaDiary.filter((r) => matchWhere(r, where)).length),
      ),
      groupBy: jest.fn(({ where }: any) =>
        Promise.resolve(schemaDiary.filter((r) => matchWhere(r, where))),
      ),
    },
    modeDiaryEntry: {
      count: jest.fn(({ where }: any) =>
        Promise.resolve(modeDiary.filter((r) => matchWhere(r, where)).length),
      ),
      groupBy: jest.fn(({ where }: any) =>
        Promise.resolve(modeDiary.filter((r) => matchWhere(r, where))),
      ),
    },
    gratitudeDiaryEntry: {
      count: jest.fn(({ where }: any) =>
        Promise.resolve(
          gratitudeDiary.filter((r) => matchWhere(r, where)).length,
        ),
      ),
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(gratitudeDiary.filter((r) => matchWhere(r, where))),
      ),
    },
  };
  return {
    db,
    relations,
    tasks,
    users,
    ratings,
    schemaDiary,
    modeDiary,
    gratitudeDiary,
  };
}

function makeService() {
  const t = makeDb();
  const notificationService = {
    schedule: jest.fn(() => Promise.resolve()),
  } as any;
  const tasksService = new TherapyTasksService(t.db, notificationService);
  const service = new TherapyTasksViewService(t.db, tasksService);
  return { service, tasksService, ...t };
}

const T1 = 100n; // владелец связи
const T2 = 200n; // чужой терапевт
const CLIENT_A = 555n;
const CLIENT_B = 777n;

describe('TherapyTasksViewService.getAllTasksForTherapist', () => {
  it('видит только задачи своих активных клиентов и только те, что назначил сам', async () => {
    const { service, relations, tasks } = makeService();
    relations.push({
      id: 1,
      therapistId: T1,
      clientId: CLIENT_A,
      status: 'active',
      clientName: 'Аня',
    });
    tasks.push(
      {
        id: 1,
        userId: CLIENT_A,
        assignedBy: T1,
        type: 'custom',
        text: encrypt('от T1') ?? 'от T1',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
      // Задача от ДРУГОГО терапевта тому же клиенту A — не должна попасть в обзор T1
      {
        id: 2,
        userId: CLIENT_A,
        assignedBy: T2,
        type: 'custom',
        text: encrypt('от T2') ?? 'от T2',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
      // Задача клиенту B, с которым у T1 нет связи — не должна попасть
      {
        id: 3,
        userId: CLIENT_B,
        assignedBy: T1,
        type: 'custom',
        text: encrypt('чужой клиент') ?? 'чужой клиент',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
    );
    const result = await service.getAllTasksForTherapist(T1);
    expect(result).toHaveLength(1);
    expect(result[0].clientName).toBe('Аня');
    expect(result[0].tasks).toHaveLength(1);
    expect(result[0].tasks[0].text).toBe('от T1');
  });

  it('виртуальный клиент: имя берётся из clientAlias, иначе virtualClientName, иначе "ID N"', async () => {
    const { service, relations, tasks } = makeService();
    relations.push({
      id: 42,
      therapistId: T1,
      clientId: null,
      status: 'active',
      virtualClientName: 'Оффлайн клиент',
    });
    tasks.push({
      id: 1,
      userId: -42n,
      assignedBy: T1,
      type: 'custom',
      text: 'офлайн задача',
      targetDays: null,
      needId: null,
      dueDate: null,
      done: null,
      completedAt: null,
      createdAt: new Date(),
    });
    const result = await service.getAllTasksForTherapist(T1);
    expect(result).toHaveLength(1);
    expect(result[0].clientId).toBe(-42);
    expect(result[0].clientName).toBe('Оффлайн клиент');
  });
});

describe('TherapyTasksViewService.getTasksForClient — доступ по активной связи', () => {
  it('без активной связи с клиентом — null (даже если задачи от этого терапевта в БД есть)', async () => {
    const { service, tasks } = makeService();
    tasks.push({
      id: 1,
      userId: CLIENT_A,
      assignedBy: T2,
      type: 'custom',
      text: 'x',
      targetDays: null,
      needId: null,
      dueDate: null,
      done: null,
      completedAt: null,
      createdAt: new Date(),
    });
    const result = await service.getTasksForClient(T2, Number(CLIENT_A));
    expect(result).toBeNull();
  });

  it('с активной связью — возвращает задачи, расшифрованные, с прогрессом через TherapyTasksService.getStreakProgress', async () => {
    const { service, relations, tasks, users, ratings } = makeService();
    relations.push({
      id: 1,
      therapistId: T1,
      clientId: CLIENT_A,
      status: 'active',
    });
    users.push({ id: CLIENT_A, notifyTimezone: 'Europe/Moscow' });
    const today = new Date().toISOString().slice(0, 10);
    ratings.push({ userId: CLIENT_A, date: today });
    tasks.push({
      id: 1,
      userId: CLIENT_A,
      assignedBy: T1,
      type: 'tracker_streak',
      text: encrypt('трекер каждый день') ?? 'трекер каждый день',
      targetDays: 3,
      needId: null,
      dueDate: null,
      done: null,
      completedAt: null,
      createdAt: new Date(),
    });
    const [task] = (await service.getTasksForClient(T1, Number(CLIENT_A)))!;
    expect(task.text).toBe('трекер каждый день');
    expect(task.doneToday).toBe(true);
    expect(task.progress).toBe(1); // одна отметка сегодня => прогресс 1 из 3
  });

  it('виртуальный клиент (отрицательный id): без активной связи по relation.id — null; с ней — задачи без doneToday/progress', async () => {
    const { service, relations, tasks } = makeService();
    relations.push({
      id: 42,
      therapistId: T1,
      clientId: null,
      status: 'active',
      virtualClientName: 'V',
    });
    tasks.push({
      id: 1,
      userId: -42n,
      assignedBy: T1,
      type: 'custom',
      text: encrypt('офлайн задача') ?? 'офлайн задача',
      targetDays: null,
      needId: null,
      dueDate: null,
      done: null,
      completedAt: null,
      createdAt: new Date(),
    });

    const foreignAttempt = await service.getTasksForClient(T2, -42);
    expect(foreignAttempt).toBeNull();

    const [task] = (await service.getTasksForClient(T1, -42))!;
    expect(task.text).toBe('офлайн задача');
    expect(task.doneToday).toBeUndefined();
    expect(task.progress).toBeUndefined();
  });
});
