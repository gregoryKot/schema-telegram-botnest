import type { AnalyticsService } from '../analytics/analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TherapyInviteService } from './therapy-invite.service';
import { createInviteFromCard } from './therapy-invite-from-card';
import type { TherapyRelationsService } from './therapy-relations.service';

jest.mock('./therapy-invite-from-card', () => ({
  createInviteFromCard: jest.fn(),
}));
const fromCard = createInviteFromCard as jest.Mock;

function make(attachToId: number | null = null) {
  const prisma = {
    therapyRelation: {
      findUnique: jest.fn().mockResolvedValue({ attachToId }),
      findFirst: jest.fn().mockResolvedValue({ attachToId }),
    },
  };
  const relations = {
    createInvite: jest.fn().mockResolvedValue({ code: 'C', url: 'u' }),
    joinAsClient: jest.fn().mockResolvedValue(true),
    revokeInvite: jest.fn().mockResolvedValue(true),
    listInvites: jest.fn().mockResolvedValue([]),
    previewInvite: jest.fn().mockResolvedValue(null),
  };
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const svc = new TherapyInviteService(
    prisma as unknown as PrismaService,
    relations as unknown as TherapyRelationsService,
    analytics as unknown as AnalyticsService,
  );
  return { svc, relations, analytics, prisma };
}

beforeEach(() => fromCard.mockReset());

describe('TherapyInviteService — событие therapy_invite', () => {
  it('create → created/new от имени терапевта', async () => {
    const { svc, analytics } = make();
    await svc.create(1n, 'Мария');
    expect(analytics.track).toHaveBeenCalledWith(1n, 'therapy_invite', {
      step: 'created',
      kind: 'new',
    });
  });

  it('createFromCard: новое → created/offline, created не уходит наружу', async () => {
    fromCard.mockResolvedValue({ code: 'C', url: 'u', created: true });
    const { svc, analytics } = make();
    expect(await svc.createFromCard(1n, -7n)).toEqual({ code: 'C', url: 'u' });
    expect(analytics.track).toHaveBeenCalledWith(1n, 'therapy_invite', {
      step: 'created',
      kind: 'offline',
    });
  });

  it('createFromCard: возврат живого приглашения — события нет', async () => {
    fromCard.mockResolvedValue({ code: 'C', url: 'u', created: false });
    const { svc, analytics } = make();
    expect(await svc.createFromCard(1n, -7n)).toEqual({ code: 'C', url: 'u' });
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'new'],
    [7, 'offline'],
  ])('join (attachToId %s) → joined/%s от имени клиента', async (a, kind) => {
    const { svc, analytics, prisma } = make(a);
    await svc.join(50n, 'abc');
    expect(prisma.therapyRelation.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC' },
      select: { attachToId: true },
    });
    expect(analytics.track).toHaveBeenCalledWith(50n, 'therapy_invite', {
      step: 'joined',
      kind,
    });
  });

  it('join без успеха — события нет', async () => {
    const { svc, relations, analytics } = make();
    relations.joinAsClient.mockResolvedValue(false);
    expect(await svc.join(50n, 'abc')).toBe(false);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'new'],
    [7, 'offline'],
  ])('revoke (attachToId %s) → revoked/%s', async (a, kind) => {
    const { svc, analytics } = make(a);
    await svc.revoke(1n, 3);
    expect(analytics.track).toHaveBeenCalledWith(1n, 'therapy_invite', {
      step: 'revoked',
      kind,
    });
  });

  it('revoke без успеха — события нет', async () => {
    const { svc, relations, analytics } = make();
    relations.revokeInvite.mockResolvedValue(false);
    expect(await svc.revoke(1n, 3)).toBe(false);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('list и preview — прокси', async () => {
    const { svc, relations } = make();
    await svc.list(1n);
    await svc.preview(2n, 'X');
    expect(relations.listInvites).toHaveBeenCalledWith(1n);
    expect(relations.previewInvite).toHaveBeenCalledWith(2n, 'X');
  });
});
