import { dbProbe } from './probe-db';
import type { PrismaService } from '../../prisma/prisma.service';

describe('dbProbe', () => {
  it('запрос проходит — ok', async () => {
    const prisma = { cronLease: { count: jest.fn().mockResolvedValue(3) } };
    const res = await dbProbe(prisma as unknown as PrismaService).run();
    expect(res).toEqual({ ok: true, detail: 'отвечает' });
  });

  it('запрос падает — не ok, деталь из ошибки', async () => {
    const prisma = {
      cronLease: {
        count: jest
          .fn()
          .mockRejectedValue(new Error("Can't reach database server")),
      },
    };
    const res = await dbProbe(prisma as unknown as PrismaService).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain("Can't reach database server");
  });

  it('critical: true — падение базы это авария ядра', () => {
    const probe = dbProbe({} as unknown as PrismaService);
    expect(probe.critical).toBe(true);
    expect(probe.id).toBe('db');
  });
});
