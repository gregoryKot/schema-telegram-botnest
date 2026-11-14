import type { PrismaService } from '../prisma/prisma.service';
import { formatLoginOffer, loadLoginOffer } from './login-offer-metrics';

describe('formatLoginOffer', () => {
  it('пустая БД — честная строка, без нулевой воронки', () => {
    const text = formatLoginOffer({ shown: 0, open: 0, later: 0 });
    expect(text).toContain('Почта, Яндекс ID или VK ID для входа на сайт');
    expect(text).toContain('приглашение никому не показывали');
    expect(text).not.toContain('Пошли добавлять');
  });

  it('показы, переходы и отложенные — простыми словами', () => {
    const text = formatLoginOffer({ shown: 12, open: 4, later: 3 });
    expect(text).toContain('Приглашение увидели: 12 раз (это показы, не люди)');
    expect(text).toContain('Пошли добавлять: 4');
    expect(text).toContain('Отложили: 3');
    expect(text).not.toMatch(/conversion|CTR|воронк/i);
  });

  it('никто не отложил — строки «Отложили» нет', () => {
    expect(formatLoginOffer({ shown: 2, open: 1, later: 0 })).not.toContain(
      'Отложили',
    );
  });
});

describe('loadLoginOffer', () => {
  it('считает события login_method_offer за неделю по действию', async () => {
    const count = jest.fn(
      ({ where }: { where: { meta: { equals: string } } }) =>
        Promise.resolve(
          { shown: 7, open: 2, later: 1 }[where.meta.equals] ?? 0,
        ),
    );
    const prisma = { analyticsEvent: { count } } as unknown as PrismaService;

    await expect(loadLoginOffer(prisma)).resolves.toEqual({
      shown: 7,
      open: 2,
      later: 1,
    });
    const where = count.mock.calls[0][0].where as unknown as {
      name: string;
      createdAt: { gte: Date };
      meta: { path: string[] };
    };
    expect(where.name).toBe('login_method_offer');
    expect(where.meta.path).toEqual(['action']);
    const ageDays = (Date.now() - where.createdAt.gte.getTime()) / 86_400_000;
    expect(ageDays).toBeCloseTo(7, 1);
  });
});
