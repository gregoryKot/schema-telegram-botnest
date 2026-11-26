// TherapyCardClaimsController (S8): только терапевт; ответ на сверку, которой
// у этого терапевта нет, — 404, событие воронки — только на сделанный ответ;
// -3000000000 в пути — 400 (S18). Логика — therapy-invite-card-claim.spec.ts.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { AccountService } from '../bot/account.service';
import type { AuthRequest } from '../api/request-utils';
import { TherapyCardClaimsController } from './therapy-card-claims.controller';
import { listCardClaims, resolveCardClaim } from './therapy-invite-card-claim';

jest.mock('./therapy-invite-card-claim', () => ({
  ...jest.requireActual('./therapy-invite-card-claim'),
  listCardClaims: jest.fn().mockResolvedValue([{ cardId: 9 }]),
  resolveCardClaim: jest.fn().mockResolvedValue(true),
}));
const listMock = listCardClaims as jest.Mock;
const resolveMock = resolveCardClaim as jest.Mock;
beforeEach(() => {
  listMock.mockClear();
  resolveMock.mockClear().mockResolvedValue(true);
});

function make(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST') {
  const prisma = {} as PrismaService;
  const track = jest.fn().mockResolvedValue(undefined);
  const account = { getUserRole: jest.fn().mockResolvedValue(role) };
  const controller = new TherapyCardClaimsController(
    prisma,
    { track } as unknown as AnalyticsService,
    account as unknown as AccountService,
  );
  return { controller, prisma, track };
}
const req = (userId = 7n) => ({ webUser: { userId } }) as AuthRequest;

describe('TherapyCardClaimsController.list', () => {
  it('терапевт получает свои сверки', async () => {
    const { controller, prisma } = make();
    await expect(controller.list(req(3n))).resolves.toEqual([{ cardId: 9 }]);
    expect(listMock).toHaveBeenCalledWith(prisma, 3n);
  });

  it('не терапевт — 403, выборки нет', async () => {
    const { controller } = make('CLIENT');
    await expect(controller.list(req())).rejects.toThrow(ForbiddenException);
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe('TherapyCardClaimsController.resolve', () => {
  it('«Да» → resolveCardClaim и событие confirmed', async () => {
    const { controller, prisma, track } = make();
    await expect(
      controller.resolve(req(3n), '500', { cardId: 9, accept: true }),
    ).resolves.toEqual({ ok: true });
    expect(resolveMock).toHaveBeenCalledWith(prisma, 3n, 500n, 9, true);
    expect(track).toHaveBeenCalledWith(3n, 'therapy_invite', {
      step: 'confirmed',
      kind: 'offline',
    });
  });

  it('сверки нет (чужая, уже отвечена) → 404, события нет', async () => {
    resolveMock.mockResolvedValue(false);
    const { controller, track } = make();
    await expect(
      controller.resolve(req(), '500', { cardId: 9, accept: false }),
    ).rejects.toThrow(NotFoundException);
    expect(track).not.toHaveBeenCalled();
  });

  it('не терапевт → 403; id за int32 → 400', async () => {
    await expect(
      make('CLIENT').controller.resolve(req(), '500', {
        cardId: 9,
        accept: true,
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      make().controller.resolve(req(), '-3000000000', {
        cardId: 9,
        accept: true,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(resolveMock).not.toHaveBeenCalled();
  });
});
