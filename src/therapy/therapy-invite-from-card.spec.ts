import type { PrismaService } from '../prisma/prisma.service';
import { decryptName, encryptName } from './client-name';
import { createInviteFromCard } from './therapy-invite-from-card';

const card = {
  id: 7,
  therapistId: 1n,
  clientId: null,
  status: 'active',
  virtualClientName: encryptName('Мария К.'),
};

jest.mock('../telegram/miniapp-link', () => ({
  optionalMiniappStartLink: (s: string) => `https://t.me/bot/app?startapp=${s}`,
}));

function make(opts: { card?: unknown; live?: unknown }) {
  const findFirst = jest
    .fn()
    .mockResolvedValueOnce(opts.card === undefined ? card : opts.card)
    .mockResolvedValueOnce(opts.live ?? null);
  const create = jest.fn().mockResolvedValue({});
  const prisma = {
    therapyRelation: {
      findFirst,
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create,
    },
  } as unknown as PrismaService;
  return { prisma, create, findFirst };
}

describe('createInviteFromCard', () => {
  it('положительный id → No active relation', async () => {
    const { prisma, findFirst } = make({});
    await expect(createInviteFromCard(prisma, 1n, 5n)).rejects.toThrow(
      'No active relation',
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('нет офлайн-строки → No active relation', async () => {
    const { prisma } = make({ card: null });
    await expect(createInviteFromCard(prisma, 1n, -7n)).rejects.toThrow(
      'No active relation',
    );
  });

  it('строка без virtualClientName → No active relation', async () => {
    const { prisma } = make({ card: { ...card, virtualClientName: null } });
    await expect(createInviteFromCard(prisma, 1n, -7n)).rejects.toThrow(
      'No active relation',
    );
  });

  it('живое приглашение есть → возвращается оно, create не зовётся', async () => {
    const { prisma, create, findFirst } = make({
      live: { code: 'AAAAAAAAAAAA' },
    });
    const res = await createInviteFromCard(prisma, 1n, -7n);
    expect(res).toMatchObject({ code: 'AAAAAAAAAAAA', created: false });
    expect(res.url).toContain('therapy_AAAAAAAAAAAA');
    expect(create).not.toHaveBeenCalled();
    expect(findFirst.mock.calls[1][0].where).toMatchObject({ attachToId: 7 });
  });

  it('нет живого → создаётся с attachToId и именем карточки', async () => {
    const { prisma, create } = make({});
    const res = await createInviteFromCard(prisma, 1n, -7n);
    expect(res.created).toBe(true);
    const data = create.mock.calls[0][0].data;
    expect(data.attachToId).toBe(7);
    expect(decryptName(data.clientAlias)).toBe('Мария К.');
    expect(res.code).toBe(data.code);
  });
});
