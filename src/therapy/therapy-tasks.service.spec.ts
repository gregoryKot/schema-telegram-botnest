// Тесты на TherapyTasksService (не покрыт ранее): изоляция задач по userId
// (completeTask/getTasks/getTaskHistory), авто-экспирация стрик-задач,
// авто-завершение по прогрессу (checkStreakTasks), расшифровка text на
// чтении. Access-control для "терапевт назначает клиенту" находится в
// контроллере (assertHasClient вызывается в TherapyTasksController.createTask,
// см. src/therapy/therapy-tasks.controller.ts) — сам сервис createTask
// ownership не проверяет, это сознательно не e2e-покрыто здесь (правило
// "controllers — see e2e" из задания).
//
// Серия с дня назначения (инцидент 2026-11-04, docs/INCIDENTS.md): окно
// прогресса было «последние N суток», и клиент, отмечавшийся неделю до
// назначения, закрывал задание на 7 дней первой оценкой в тот же день.
import { TherapyTasksService } from './therapy-tasks.service';
import { encrypt } from '../utils/crypto';
import { renderTemplate } from '../notification/notification.templates';
import { localDate } from '../utils/tz';

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
      // Окно серии — обе границы сразу: { gte, lt } (streak-window.ts)
      if ('gte' in v || 'lt' in v)
        return (!('gte' in v) || val >= v.gte) && (!('lt' in v) || val < v.lt);
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
    // День клиента (зона по умолчанию — Москва), не UTC: с 21:00 UTC там
    // уже завтра, и UTC-дата фикстуры выпадала бы из окна серии.
    const today = localDate('Europe/Moscow', new Date());
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
      { type: 'diary_streak', createdAt: new Date(`${day}T00:00:00Z`) },
      'UTC',
    );
    expect(progress).toBe(1); // один и тот же день, не три
  });
});

describe('TherapyTasksService — серия считается с дня назначения (инцидент 2026-11-04)', () => {
  const streakTask = (createdAt: Date, targetDays = 7) => ({
    id: 1,
    userId: CLIENT_A,
    assignedBy: THERAPIST,
    type: 'tracker_streak',
    text: 't',
    targetDays,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt,
  });

  it('неделя оценок до назначения не закрывает задание: после одной оценки — 1 из 7, задание в работе', async () => {
    const { service, tasks, users, ratings } = makeService();
    users.push({ id: CLIENT_A, notifyTimezone: 'Europe/Moscow' });
    const now = Date.now();
    for (let i = 0; i < 7; i++) {
      const date = localDate('Europe/Moscow', new Date(now - i * 86_400_000));
      ratings.push({ userId: CLIENT_A, date });
    }
    tasks.push(streakTask(new Date(now)));

    await service.checkStreakTasks(CLIENT_A);
    expect(tasks[0].done).toBeNull(); // до починки — true, закрыто в день назначения
    const [task] = await service.getTasks(CLIENT_A);
    expect(task.progress).toBe(1);
  });

  it('день назначения — по календарю клиента: 01:30 по Москве = 22:30 UTC вчера, вчерашняя оценка не в счёт', async () => {
    const { service, ratings } = makeService();
    ratings.push(
      { userId: CLIENT_A, date: '2026-11-03' },
      { userId: CLIENT_A, date: '2026-11-04' },
    );
    const assignedAt = new Date('2026-11-03T22:30:00Z');
    const task = { type: 'tracker_streak', createdAt: assignedAt };
    expect(
      await service.getStreakProgress(CLIENT_A, task, 'Europe/Moscow'),
    ).toBe(1);
    // В UTC-днях назначение было 3-го, и оба дня считались бы.
    expect(await service.getStreakProgress(CLIENT_A, task, 'UTC')).toBe(2);
  });

  it('diary_streak: записи — по дню клиента; запись до полуночи дня назначения не в счёт', async () => {
    const { service, schemaDiary, modeDiary } = makeService();
    schemaDiary.push(
      // 23:30 по Москве 3-го — до дня назначения
      { userId: CLIENT_A, createdAt: new Date('2026-11-03T20:30:00Z') },
      // 01:30 по Москве 4-го (в UTC ещё 3-е)
      { userId: CLIENT_A, createdAt: new Date('2026-11-03T22:30:00Z') },
    );
    modeDiary.push({
      userId: CLIENT_A,
      createdAt: new Date('2026-11-04T10:00:00Z'),
    });
    const progress = await service.getStreakProgress(
      CLIENT_A,
      { type: 'diary_streak', createdAt: new Date('2026-11-03T21:15:00Z') },
      'Europe/Moscow',
    );
    expect(progress).toBe(1); // обе записи 4-го по Москве — один день
  });
});

describe('TherapyTasksService — scheduleTaskNotification', () => {
  // Баг 2026-11-05 (docs/INCIDENTS.md): карточка схемы приходила клиенту как
  // «emotional_deprivation». Шов: payload сервиса → настоящий шаблон бота.
  it('карточка схемы: в сообщении бота — название, а не id', async () => {
    const { service, notificationService } = makeService();
    await service.scheduleTaskNotification(CLIENT_A, {
      type: 'schema_intro',
      text: 'emotional_deprivation',
      needId: null,
      dueDate: null,
    });
    const payload = notificationService.schedule.mock.calls[0][3];
    const msg = renderTemplate('task_assigned', payload)!.text;
    expect(msg).toContain('Карточка схемы: Эмоциональная депривация');
    expect(msg).not.toContain('emotional_deprivation');
  });

  // Аудит 2026-11, U2: кнопка вела на «Сегодня», где заданий нет. Шов: id
  // задания из контроллера → payload → кнопка настоящего шаблона бота.
  it('кнопка уведомления открывает само задание (ссылка запуска tasks_<id>)', async () => {
    const { service, notificationService } = makeService();
    await service.scheduleTaskNotification(CLIENT_A, {
      type: 'custom',
      text: 'сделай практику',
      needId: null,
      dueDate: null,
      taskId: 42,
    });
    const payload = notificationService.schedule.mock.calls[0][3];
    const kb = JSON.stringify(
      renderTemplate('task_assigned', payload)!.keyboard,
    );
    expect(kb).toContain('/today?startapp=tasks_42');
  });

  it('вызывает notificationService.schedule с типом task_assigned и payload задачи', async () => {
    const { service, notificationService } = makeService();
    await service.scheduleTaskNotification(CLIENT_A, {
      type: 'custom',
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

  it('schema_intro: в payload название схемы, а не id (баг 2026-11-05)', async () => {
    const { service, notificationService } = makeService();
    await service.scheduleTaskNotification(CLIENT_A, {
      type: 'schema_intro',
      text: 'emotional_deprivation',
      needId: null,
      dueDate: null,
    });
    expect(notificationService.schedule).toHaveBeenCalledWith(
      CLIENT_A,
      'task_assigned',
      expect.any(Date),
      {
        text: 'Карточка схемы: Эмоциональная депривация',
        needId: null,
        dueDate: null,
      },
    );
  });
});

// E15 аудита 2026-11: окно серии шло от дня назначения до «сейчас», а
// просрочка ставилась лениво (при открытии /tasks). Клиент, не открывавший
// задания, отмечался после срока — отметки засчитывались, и просроченное
// задание закрывалось выполненным. Окно — targetDays местных дней клиента.
describe('TherapyTasksService — окно серии ограничено сроком (E15)', () => {
  afterEach(() => jest.useRealTimers());

  const task = (
    createdAt: string,
    targetDays: number,
    type = 'tracker_streak',
  ) => ({
    id: 1,
    userId: CLIENT_A,
    assignedBy: THERAPIST,
    type,
    text: 't',
    targetDays,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: new Date(createdAt),
  });

  it('отметки после срока не закрывают задание выполненным', async () => {
    const { service, tasks, users, ratings } = makeService();
    users.push({ id: CLIENT_A, notifyTimezone: 'Europe/Moscow' });
    // назначено 1-го (12:00 МСК), 3 дня: окно 1–3 ноября
    tasks.push(task('2026-11-01T09:00:00Z', 3));
    for (const date of ['2026-11-01', '2026-11-04', '2026-11-05'])
      ratings.push({ userId: CLIENT_A, date });
    await service.checkStreakTasks(CLIENT_A);
    expect(tasks[0].done).toBeNull(); // до починки — true: 3 «дня» из 3
  });

  it.each([
    // 15:00 в Нью-Йорке 1-го, 2 дня: окно 1–2 ноября по Нью-Йорку
    ['America/New_York', '2026-11-01T20:00:00Z'],
    // 09:30 во Владивостоке 1-го (в UTC ещё 31 октября)
    ['Asia/Vladivostok', '2026-10-31T23:30:00Z'],
    ['Asia/Kolkata', '2026-10-31T19:00:00Z'], // 00:30 1-го по Калькутте
  ])('конец окна — по календарю клиента (%s)', async (tz, createdAt) => {
    const { service, ratings } = makeService();
    for (const date of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'])
      ratings.push({ userId: CLIENT_A, date });
    const t = {
      type: 'tracker_streak',
      createdAt: new Date(createdAt),
      targetDays: 2,
    };
    expect(await service.getStreakProgress(CLIENT_A, t, tz)).toBe(2);
  });

  it('diary_streak: запись после полуночи последнего дня окна не в счёт', async () => {
    const { service, schemaDiary } = makeService();
    schemaDiary.push(
      // 23:59 по Москве 4-го — последний день окна
      { userId: CLIENT_A, createdAt: new Date('2026-11-04T20:59:00Z') },
      // 00:30 по Москве 5-го — уже за окном
      { userId: CLIENT_A, createdAt: new Date('2026-11-04T21:30:00Z') },
    );
    const t = {
      type: 'diary_streak',
      createdAt: new Date('2026-11-03T21:15:00Z'), // 00:15 МСК 4-го
      targetDays: 1,
    };
    expect(await service.getStreakProgress(CLIENT_A, t, 'Europe/Moscow')).toBe(
      1,
    );
  });

  it('срок — по календарю клиента: Владивосток, 00:30 дня после окна — задание просрочено', async () => {
    const { service, tasks, users } = makeService();
    users.push({ id: CLIENT_A, notifyTimezone: 'Asia/Vladivostok' });
    tasks.push(task('2026-11-01T01:00:00Z', 3)); // 11:00 1-го: окно 1–3 ноября
    jest.useFakeTimers({ now: new Date('2026-11-03T13:30:00Z') }); // 23:30 3-го
    expect(await service.getTasks(CLIENT_A)).toHaveLength(1);
    jest.setSystemTime(new Date('2026-11-03T14:30:00Z')); // 00:30 4-го
    // по суткам от назначения прошло 2,5 — раньше задание жило ещё полдня
    expect(await service.getTasks(CLIENT_A)).toHaveLength(0);
    expect(tasks[0].done).toBe(false);
  });
});
