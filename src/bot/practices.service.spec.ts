import { PracticesService } from './practices.service';

// Stateful in-memory fake Prisma для UserPractice + PracticePlan.
// Приоритет: read-after-write через шифрование practiceText/text, и
// изоляция по userId на checkinPlan (чужой план нельзя отметить выполненным).
function makeDb() {
  const practices: any[] = [];
  const plans: any[] = [];
  let nextId = 1;

  const db: any = {
    userPractice: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        practices.push(row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        practices.filter(
          (r) => r.userId === where.userId && r.needId === where.needId,
        ),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = practices.length;
        const kept = practices.filter(
          (r) => !(r.id === where.id && r.userId === where.userId),
        );
        practices.length = 0;
        practices.push(...kept);
        return { count: before - kept.length };
      }),
    },
    practicePlan: {
      create: jest.fn(({ data }: any) => {
        const row = {
          id: nextId++,
          createdAt: new Date(),
          done: null,
          ...data,
        };
        plans.push(row);
        return row;
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const matched = plans.filter(
          (p) => p.id === where.id && p.userId === where.userId,
        );
        matched.forEach((p) => Object.assign(p, data));
        return { count: matched.length };
      }),
      findMany: jest.fn(({ where }: any) =>
        plans.filter((p) => {
          if (p.userId !== where.userId) return false;
          if (
            where.scheduledDate?.gte &&
            p.scheduledDate < where.scheduledDate.gte
          )
            return false;
          if (
            where.scheduledDate &&
            !where.scheduledDate.gte &&
            p.scheduledDate !== where.scheduledDate
          )
            return false;
          if ('done' in where && p.done !== where.done) return false;
          return true;
        }),
      ),
    },
    _plans: plans,
  };
  return db;
}

describe('PracticesService — practice read-after-write', () => {
  it('сохранённая практика читается назад с расшифрованным текстом', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);

    await svc.addPractice(1n, 'attachment', 'позвонить другу');
    const rows = await svc.getPractices(1n, 'attachment');

    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('позвонить другу');
  });

  it('deletePractice чужим userId не удаляет запись', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    await svc.addPractice(1n, 'attachment', 'x');
    const [row] = await svc.getPractices(1n, 'attachment');

    await svc.deletePractice(2n, row.id);

    expect(await svc.getPractices(1n, 'attachment')).toHaveLength(1);
  });
});

describe('PracticesService — план: read-after-write и изоляция чек-ина', () => {
  it('createPlan возвращает практикTекст открытым текстом (не шифроблоб)', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);

    const plan = await svc.createPlan(
      1n,
      'attachment',
      'написать письмо',
      '2026-07-20',
    );

    expect(plan.practiceText).toBe('написать письмо');
  });

  it('checkinPlan чужим userId не меняет чужой план (ownership-инвариант)', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    const plan = await svc.createPlan(1n, 'attachment', 'x', '2026-07-20');

    await svc.checkinPlan(2n, plan.id, true);

    expect(db._plans[0].done).toBeNull();
  });

  it('checkinPlan владельцем помечает план выполненным', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    const plan = await svc.createPlan(1n, 'attachment', 'x', '2026-07-20');

    await svc.checkinPlan(1n, plan.id, true);

    expect(db._plans[0].done).toBe(true);
  });

  it('getMissedPlans возвращает только незавершённые планы точной даты', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    await svc.createPlan(1n, 'attachment', 'просрочен', '2026-07-15');
    const done = await svc.createPlan(
      1n,
      'attachment',
      'выполнен',
      '2026-07-15',
    );
    await svc.checkinPlan(1n, done.id, true);

    const missed = await svc.getMissedPlans(1n, '2026-07-15');

    expect(missed).toHaveLength(1);
    expect(missed[0].practiceText).toBe('просрочен');
  });

  it('getPendingPlans фильтрует по дате >= и done === null', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    await svc.createPlan(1n, 'attachment', 'старый', '2026-07-10');
    await svc.createPlan(1n, 'attachment', 'будущий', '2026-07-20');

    const pending = await svc.getPendingPlans(1n, '2026-07-15');

    expect(pending.map((p) => p.practiceText)).toEqual(['будущий']);
  });
});
