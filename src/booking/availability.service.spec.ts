// AvailabilityService — CRUD правил расписания (admin-only). Логика тут
// минимальна (дефолты create, 404 на несуществующем id), но именно эти
// правила потом читает SlotService для генерации слотов — ошибка в
// дефолтах молча меняет расписание на проде.
import { NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

function makeService(rows: any[] = []) {
  const store = [...rows];
  const prisma: any = {
    availabilityRule: {
      findMany: jest.fn(({ orderBy }: any = {}) => {
        void orderBy;
        return Promise.resolve([...store]);
      }),
      create: jest.fn(({ data }: any) => {
        const row = { id: store.length + 1, ...data };
        store.push(row);
        return Promise.resolve(row);
      }),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(store.find((r) => r.id === where.id) ?? null),
      ),
      update: jest.fn(({ where, data }: any) => {
        const row = store.find((r) => r.id === where.id);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      delete: jest.fn(({ where }: any) => {
        const i = store.findIndex((r) => r.id === where.id);
        store.splice(i, 1);
        return Promise.resolve();
      }),
    },
  };
  return { service: new AvailabilityService(prisma), prisma, store };
}

describe('AvailabilityService.list', () => {
  it('возвращает все правила', async () => {
    const { service } = makeService([{ id: 1, dayOfWeek: 1 }]);
    expect(await service.list()).toHaveLength(1);
  });

  it('сортирует по dayOfWeek, затем startHour', async () => {
    const { service, prisma } = makeService();
    await service.list();
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
      orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }],
    });
  });
});

describe('AvailabilityService.create — дефолты', () => {
  it('минимальный DTO — startMinute/endMinute=0, sessionDuration=50, bufferMin=10, timezone=Europe/Moscow', async () => {
    const { service } = makeService();
    const rule = await service.create({
      dayOfWeek: 1,
      startHour: 10,
      endHour: 19,
    });
    expect(rule).toMatchObject({
      dayOfWeek: 1,
      startHour: 10,
      startMinute: 0,
      endHour: 19,
      endMinute: 0,
      sessionDuration: 50,
      bufferMin: 10,
      timezone: 'Europe/Moscow',
    });
  });

  it('явно переданные значения переопределяют дефолты', async () => {
    const { service } = makeService();
    const rule = await service.create({
      dayOfWeek: 2,
      startHour: 9,
      startMinute: 30,
      endHour: 18,
      endMinute: 15,
      sessionDuration: 30,
      bufferMin: 5,
      timezone: 'Europe/London',
    });
    expect(rule).toMatchObject({
      startMinute: 30,
      endMinute: 15,
      sessionDuration: 30,
      bufferMin: 5,
      timezone: 'Europe/London',
    });
  });
});

describe('AvailabilityService.setActive', () => {
  it('несуществующий id — NotFoundException', async () => {
    const { service } = makeService([]);
    await expect(service.setActive(99, false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('существующее правило — обновляет isActive', async () => {
    const { service } = makeService([{ id: 1, isActive: true }]);
    const rule = await service.setActive(1, false);
    expect(rule.isActive).toBe(false);
  });
});

describe('AvailabilityService.remove', () => {
  it('несуществующий id — NotFoundException, delete не вызывается', async () => {
    const { service, prisma } = makeService([]);
    await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    expect(prisma.availabilityRule.delete).not.toHaveBeenCalled();
  });

  it('существующее правило — удаляет и возвращает { ok: true }', async () => {
    const { service, store } = makeService([{ id: 1 }]);
    const result = await service.remove(1);
    expect(result).toEqual({ ok: true });
    expect(store).toHaveLength(0);
  });
});
