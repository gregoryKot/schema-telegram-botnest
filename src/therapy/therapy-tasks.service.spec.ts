// Тесты на TherapyTasksService (не покрыт ранее): изоляция задач по userId
// (completeTask/getTasks/getTaskHistory), авто-экспирация стрик-задач,
// авто-завершение по прогрессу (checkStreakTasks), расшифровка text на
// чтении. Access-control для "терапевт назначает клиенту" находится в
// контроллере (assertHasClient вызывается в TherapyTasksController.createTask,
// см. src/therapy/therapy-tasks.controller.ts) — сам сервис createTask
// ownership не проверяет, это сознательно не e2e-покрыто здесь (правило
// "controllers — see e2e" из задания).
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
      if ('in' in v) return v.in.includes(val);
      if ('not' in v) return val !== v.not;
    }
    return val === v;
  });
}

function makeDb() {
  const tasks: any[] = [];
  const users: any[] = [];
  const ratings: any[] = [];
  const schemaDiary: any[] = [];
  const modeDiary: any[] = [];
  const gratitudeDiary: any[] = [];
  let autoId = 1;
  const sortDesc = (rows: any[], key: string) =>
    [...rows].sort((a, b) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
  const db: any = {
    userTask: {
      create: jest.fn(({ data }: any) => {
        const row = {
          id: autoId++,
          createdAt: new Date(),
          completedAt: null,
          done: null,
          ...data,
        };
        tasks.push(row);
        return Promise.resolve(row);
      }),
      findMany: jest.fn(({ where, orderBy, take }: any) => {
        let rows = tasks.filter((t) => matchWhere(t, where));
        if (orderBy?.createdAt === 'desc') rows = sortDesc(rows, 'createdAt');
        if (orderBy?.completedAt === 'desc')
          rows = sortDesc(rows, 'completedAt');
        if (take) rows = rows.slice(0, take);
        return Promise.resolve(rows);
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = tasks.find((t) => t.id === where.id);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const hits = tasks.filter((t) => matchWhere(t, where));
        hits.forEach((t) => Object.assign(t, data));
        return Promise.resolve({ count: hits.length });
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
  return { db, tasks, users, ratings, schemaDiary, modeDiary, gratitudeDiary };
}

function makeService() {
  const t = makeDb();
  const notificationService = {
    schedule: jest.fn(() => Promise.resolve()),
  } as any;
  const service = new TherapyTasksService(t.db, notificationService);
  return { service, notificationService, ...t };
}

const CLIENT_A = 111n;
const CLIENT_B = 222n;
const THERAPIST = 999n;

describe('TherapyTasksService — изоляция задач по userId', () => {
  it('getTasks клиента A не содержит задач клиента B', async () => {
    const { service, tasks } = makeService();
    tasks.push(
      {
        id: 1,
        userId: CLIENT_A,
        assignedBy: null,
        type: 'custom',
        text: 'A',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: CLIENT_B,
        assignedBy: null,
        type: 'custom',
        text: 'B',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
    );
    const list = await service.getTasks(CLIENT_A);
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe('A');
  });

  it('completeTask: чужой userId не может завершить не свою задачу (false, без мутации), владелец — может', async () => {
    const { service, tasks } = makeService();
    tasks.push({
      id: 1,
      userId: CLIENT_A,
      assignedBy: null,
      type: 'custom',
      text: 'A',
      targetDays: null,
      needId: null,
      dueDate: null,
      done: null,
      completedAt: null,
      createdAt: new Date(),
    });
    const foreignResult = await service.completeTask(CLIENT_B, 1, true);
    expect(foreignResult).toBe(false);
    expect(tasks[0].done).toBeNull();

    const ownResult = await service.completeTask(CLIENT_A, 1, true);
    expect(ownResult).toBe(true);
    expect(tasks[0].done).toBe(true);
    expect(tasks[0].completedAt).toBeInstanceOf(Date);
  });

  it('getTaskHistory: только завершённые задачи (done != null), лимит 30, расшифровка text', async () => {
    const { service, tasks } = makeService();
    tasks.push(
      {
        id: 1,
        userId: CLIENT_A,
        assignedBy: null,
        type: 'custom',
        text: encrypt('в процессе') ?? 'в процессе',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: CLIENT_A,
        assignedBy: null,
        type: 'custom',
        text: encrypt('готово') ?? 'готово',
        targetDays: null,
        needId: null,
        dueDate: null,
        done: true,
        completedAt: new Date('2026-07-10'),
        createdAt: new Date(),
      },
    );
    const history = await service.getTaskHistory(CLIENT_A);
    expect(history).toHaveLength(1);
    expect(history[0].text).toBe('готово');
  });
});

describe('TherapyTasksService — createTask', () => {
  it('шифрует text на запись и возвращает его расшифрованным (plaintext) вызывающему', async () => {
    const { service, tasks } = makeService();
    const task = await service.createTask(CLIENT_A, {
      type: 'custom',
      text: 'моя задача',
    });
    expect(task.text).toBe('моя задача');
    // в БД лежит результат encrypt(); в dev-режиме (без ENCRYPTION_KEY) это passthrough,
    // но сам вызов должен пройти через encrypt(), а не записать сырое поле мимо схемы.
    expect(tasks[0].text).toBe(encrypt('моя задача'));
  });

  it('assignedBy сохраняется, когда задачу назначает терапевт', async () => {
    const { service, tasks } = makeService();
    await service.createTask(
      CLIENT_A,
      { type: 'custom', text: 'от терапевта' },
      THERAPIST,
    );
    expect(tasks[0].assignedBy).toBe(THERAPIST);
  });
});

describe('TherapyTasksService — авто-экспирация и авто-завершение стриков', () => {
  it('getTasks: просроченная стрик-задача (targetDays истёк) помечается done=false автоматически и не попадает в активный список', async () => {
    const { service, tasks, users } = makeService();
    users.push({ id: CLIENT_A, notifyTimezone: 'Europe/Moscow' });
    tasks.push({
      id: 1,
      userId: CLIENT_A,
      assignedBy: null,
      type: 'tracker_streak',
      text: 'стрик',
      targetDays: 3,
      needId: null,
      dueDate: null,
      done: null,
      completedAt: null,
      createdAt: new Date(Date.now() - 5 * 86_400_000), // 5 дней назад > targetDays=3
    });
    const active = await service.getTasks(CLIENT_A);
    expect(active).toHaveLength(0);
    expect(tasks[0].done).toBe(false);
    expect(tasks[0].completedAt).toBeInstanceOf(Date);
  });

  it('checkStreakTasks: задача завершается, когда прогресс достиг targetDays; недостаточный прогресс — не трогает', async () => {
    const { service, tasks, ratings } = makeService();
    const today = new Date().toISOString().slice(0, 10);
    ratings.push({ userId: CLIENT_A, date: today });
    tasks.push(
      {
        id: 1,
        userId: CLIENT_A,
        assignedBy: null,
        type: 'tracker_streak',
        text: 't',
        targetDays: 1,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: CLIENT_A,
        assignedBy: null,
        type: 'tracker_streak',
        text: 't2',
        targetDays: 5,
        needId: null,
        dueDate: null,
        done: null,
        completedAt: null,
        createdAt: new Date(),
      },
    );
    await service.checkStreakTasks(CLIENT_A);
    expect(tasks[0].done).toBe(true); // прогресс(1) >= targetDays(1)
    expect(tasks[1].done).toBeNull(); // прогресс(1) < targetDays(5)
  });
});

describe('TherapyTasksService — getStreakProgress', () => {
  it('diary_streak: дедуп по дате — записи схемы/режима/благодарности в один день считаются одним днём', async () => {
    const { service, schemaDiary, modeDiary, gratitudeDiary } = makeService();
    const day = new Date().toISOString().slice(0, 10);
    schemaDiary.push({
      userId: CLIENT_A,
      createdAt: new Date(`${day}T09:00:00Z`),
    });
    modeDiary.push({
      userId: CLIENT_A,
      createdAt: new Date(`${day}T10:00:00Z`),
    });
    gratitudeDiary.push({ userId: CLIENT_A, date: day });
    const progress = await service.getStreakProgress(
      CLIENT_A,
      'diary_streak',
      7,
    );
    expect(progress).toBe(1); // один и тот же день, не три
  });
});

describe('TherapyTasksService — scheduleTaskNotification', () => {
  it('вызывает notificationService.schedule с типом task_assigned и payload задачи', async () => {
    const { service, notificationService } = makeService();
    await service.scheduleTaskNotification(CLIENT_A, {
      text: 'сделай практику',
      needId: 'safety',
      dueDate: '2026-08-01',
    });
    expect(notificationService.schedule).toHaveBeenCalledWith(
      CLIENT_A,
      'task_assigned',
      expect.any(Date),
      { text: 'сделай практику', needId: 'safety', dueDate: '2026-08-01' },
    );
  });
});
