import { HealthyAdultService } from './healthy-adult.service';
import { HEALTHY_ADULT_PHRASES } from './healthy-adult.data';

// In-memory подделка Prisma-делегата healthyAdultPhrase — покрываем связку
// запись→чтение (enabledTexts фильтрует выключенные), фолбэк на встроенный пул
// при пустой таблице и инвариант sortOrder при создании.
function makeDb() {
  const rows: any[] = [];
  let seq = 0;
  return {
    healthyAdultPhrase: {
      findMany: jest.fn(({ where }: any) => {
        let out = rows.slice();
        if (where?.enabled !== undefined)
          out = out.filter((r) => r.enabled === where.enabled);
        out.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        return Promise.resolve(out.map((r) => ({ ...r })));
      }),
      aggregate: jest.fn(() =>
        Promise.resolve({
          _max: {
            sortOrder: rows.length
              ? Math.max(...rows.map((r) => r.sortOrder))
              : null,
          },
        }),
      ),
      create: jest.fn(({ data }: any) => {
        const row = { id: ++seq, enabled: true, ...data };
        rows.push(row);
        return Promise.resolve({ ...row });
      }),
      createManyAndReturn: jest.fn(({ data }: any) => {
        const created = (data as any[]).map((d) => {
          const row = { id: ++seq, enabled: true, lastPostedAt: null, ...d };
          rows.push(row);
          return { ...row };
        });
        return Promise.resolve(created);
      }),
      count: jest.fn(({ where }: any = {}) => {
        let out = rows.slice();
        if (where?.enabled !== undefined)
          out = out.filter((r) => r.enabled === where.enabled);
        if (where?.lastPostedAt === null)
          out = out.filter((r) => !r.lastPostedAt);
        return Promise.resolve(out.length);
      }),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      ),
      update: jest.fn(({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }),
      delete: jest.fn(({ where }: any) => {
        const i = rows.findIndex((r) => r.id === where.id);
        return Promise.resolve(rows.splice(i, 1)[0]);
      }),
    },
    healthyAdultPost: (() => {
      const posts: any[] = [];
      let pseq = 0;
      return {
        create: jest.fn(({ data }: any) => {
          posts.push({ id: ++pseq, ...data });
          return Promise.resolve(posts[posts.length - 1]);
        }),
        findMany: jest.fn(({ take }: any) => {
          const out = posts
            .slice()
            .sort((a, b) => b.id - a.id)
            .slice(0, take)
            .map((r) => ({ text: r.text }));
          return Promise.resolve(out);
        }),
      };
    })(),
  } as any;
}

describe('HealthyAdultService', () => {
  it('enabledTexts на пустой таблице фолбэчит на встроенный пул', async () => {
    const svc = new HealthyAdultService(makeDb());
    const texts = await svc.enabledTexts();
    expect(texts).toEqual([...HEALTHY_ADULT_PHRASES]);
  });

  it('create → list возвращает созданное с растущим sortOrder', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.create('первая');
    await svc.create('вторая');
    const list = await svc.list();
    expect(list.map((r) => r.text)).toEqual(['первая', 'вторая']);
    expect(list[1].sortOrder).toBeGreaterThan(list[0].sortOrder);
  });

  it('enabledTexts отдаёт только включённые, в порядке sortOrder', async () => {
    const svc = new HealthyAdultService(makeDb());
    const a = await svc.create('a');
    await svc.create('b');
    await svc.update(a.id, { enabled: false });
    expect(await svc.enabledTexts()).toEqual(['b']);
  });

  it('update редактирует текст, remove удаляет', async () => {
    const svc = new HealthyAdultService(makeDb());
    const row = await svc.create('старый');
    await svc.update(row.id, { text: 'новый' });
    expect((await svc.list())[0].text).toBe('новый');
    await svc.remove(row.id);
    expect(await svc.list()).toHaveLength(0);
  });

  it('update/remove несуществующего id → NotFound', async () => {
    const svc = new HealthyAdultService(makeDb());
    await expect(svc.update(999, { text: 'x' })).rejects.toThrow();
    await expect(svc.remove(999)).rejects.toThrow();
  });

  it('pickFromPool: LRU обходит весь пул без повторов подряд (фикс дубля)', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.create('a');
    await svc.create('b');
    await svc.create('c');
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) seen.push((await svc.pickFromPool())!);
    // За полный обход — все три разные (никакая не повторилась подряд).
    expect(new Set(seen).size).toBe(3);
  });

  it('pickFromPool на пустой БД берёт встроенный пул, не дублируя недавнее', async () => {
    const svc = new HealthyAdultService(makeDb());
    const recent = [HEALTHY_ADULT_PHRASES[0]];
    const picked = await svc.pickFromPool(recent);
    expect(HEALTHY_ADULT_PHRASES).toContain(picked!);
    expect(picked).not.toBe(HEALTHY_ADULT_PHRASES[0]);
  });

  it('recordPost → recentPostTexts возвращает новые первыми', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.recordPost('первое', 'pool');
    await svc.recordPost('второе', 'ai');
    expect(await svc.recentPostTexts(10)).toEqual(['второе', 'первое']);
  });

  // Импорт: связка «вставил пачку → фразы реально в пуле», а не только
  // «метод не упал» — читаем результат тем же путём, что и админка.
  it('importMany → list показывает добавленные с растущим sortOrder', async () => {
    const svc = new HealthyAdultService(makeDb());
    const { created, report } = await svc.importMany('первая\nвторая');
    expect(report.accepted).toHaveLength(2);
    expect(created).toHaveLength(2);
    const list = await svc.list();
    expect(list.map((r) => r.text)).toEqual(['первая', 'вторая']);
    expect(list[1].sortOrder).toBeGreaterThan(list[0].sortOrder);
  });

  it('importMany не заводит дубль уже лежащей в пуле фразы', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.create('уже есть');
    const { created, report } = await svc.importMany('уже есть\nновая');
    expect(created).toHaveLength(1);
    expect(report.rejected[0].reason).toBe('уже есть в пуле');
    expect((await svc.list()).map((r) => r.text)).toEqual([
      'уже есть',
      'новая',
    ]);
  });

  it('importMany на пустом вводе ничего не создаёт', async () => {
    const svc = new HealthyAdultService(makeDb());
    const { created } = await svc.importMany('   \n\n');
    expect(created).toEqual([]);
    expect(await svc.list()).toEqual([]);
  });

  it('импортированные фразы сразу доступны каналу (enabled по умолчанию)', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.importMany('свежая фраза');
    expect(await svc.enabledTexts()).toEqual(['свежая фраза']);
  });

  it('poolStatus считает остаток неповторённых и дни', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.importMany('раз\nдва\nтри\nчетыре\nпять');
    expect(await svc.poolStatus()).toEqual({
      enabled: 5,
      unused: 5,
      daysLeft: 2, // два поста в день
    });
  });

  it('poolStatus не считает уже отзвучавшие фразы остатком', async () => {
    const svc = new HealthyAdultService(makeDb());
    await svc.importMany('раз\nдва');
    await svc.pickFromPool(); // одна ушла в канал — помечается lastPostedAt
    const status = await svc.poolStatus();
    expect(status.enabled).toBe(2);
    expect(status.unused).toBe(1);
  });

  it('poolStatus на пустом пуле не даёт NaN', async () => {
    const svc = new HealthyAdultService(makeDb());
    expect(await svc.poolStatus()).toEqual({
      enabled: 0,
      unused: 0,
      daysLeft: 0,
    });
  });
});
