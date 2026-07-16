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
});
