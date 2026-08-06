import { PracticesService } from './practices.service';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';

// Stateful in-memory fake Prisma для UserPractice + PracticePlan (общий
// src/test-support/fake-prisma.spec-helper.ts, этап 2.4 TEST_IMPROVEMENT_PLAN.md).
// Приоритет: read-after-write через шифрование practiceText/text, и
// изоляция по userId на checkinPlan (чужой план нельзя отметить выполненным).
function makeDb() {
  const plans: any[] = [];

  const db: any = {
    userPractice: createFakeTable([], { defaults: { createdAt: new Date() } }),
    practicePlan: createFakeTable(plans, {
      defaults: { createdAt: new Date(), done: null },
    }),
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

  it('getPlanHistory возвращает планы за N дней (по scheduledDate >= сегодня-N), с расшифрованным текстом и отсортированные по дате desc', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    const today = new Date();
    const iso = (daysAgo: number) =>
      new Date(today.getTime() - daysAgo * 86_400_000)
        .toISOString()
        .slice(0, 10);

    await svc.createPlan(1n, 'attachment', 'слишком старый', iso(30));
    await svc.createPlan(1n, 'attachment', 'недавний', iso(2));
    await svc.createPlan(1n, 'attachment', 'сегодняшний', iso(0));

    const history = await svc.getPlanHistory(1n, 7);

    expect(history.map((h) => h.practiceText)).toEqual([
      'сегодняшний',
      'недавний',
    ]);
  });

  it('getPlanHistory не подмешивает чужие планы (изоляция по userId)', async () => {
    const db = makeDb();
    const svc = new PracticesService(db);
    await svc.createPlan(
      1n,
      'attachment',
      'моё',
      new Date().toISOString().slice(0, 10),
    );
    await svc.createPlan(
      2n,
      'attachment',
      'чужое',
      new Date().toISOString().slice(0, 10),
    );

    const history = await svc.getPlanHistory(1n, 7);

    expect(history.map((h) => h.practiceText)).toEqual(['моё']);
  });
});
