// GET /api/therapy/my-concept и PATCH conceptualization/:clientId/share:
// клиенту без показанной схемы — 404; не терапевт — 403 до чтения связи;
// чужой клиент ('No active relation') — 403, а не 500; кривой id — 400.
// Инстанцируем напрямую, как concept-append.controller.spec.ts.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClientConceptController } from './client-concept.controller';
import type { AuthRequest } from '../api/request-utils';

function makeController(
  opts: { role?: string; relation?: boolean; shared?: Date | null } = {},
) {
  const concept = {
    therapistId: 7n,
    clientId: 42n,
    schemaIds: [],
    modeIds: [],
    modeLinks: [],
    schemaLinks: [],
    history: [],
    sharedWithClientAt: opts.shared ?? null,
    updatedAt: new Date(),
  };
  const prisma = {
    therapyRelation: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { therapist: { id: 7n, firstName: null, role: 'THERAPIST' } },
        ]),
    },
    clientConceptualization: {
      findUnique: jest.fn().mockResolvedValue(concept),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue(concept),
    },
  };
  const relations = {
    assertHasClient: jest.fn(() =>
      opts.relation === false
        ? Promise.reject(new Error('No active relation'))
        : Promise.resolve(),
    ),
  };
  const account = {
    getUserRole: jest.fn().mockResolvedValue(opts.role ?? 'THERAPIST'),
  };
  const ctrl = new ClientConceptController(
    prisma as never,
    relations as never,
    account as never,
  );
  return { ctrl, prisma, relations };
}

const req = { webUser: { userId: 42n } } as AuthRequest;

describe('ClientConceptController.getMyConcept', () => {
  it('не показана — 404', async () => {
    const { ctrl } = makeController({ shared: null });
    await expect(ctrl.getMyConcept(req)).rejects.toThrow(NotFoundException);
  });

  it('показана — вид клиента', async () => {
    const at = new Date('2026-11-06T09:00:00Z');
    const { ctrl } = makeController({ shared: at });
    await expect(ctrl.getMyConcept(req)).resolves.toMatchObject({
      sharedWithClientAt: at,
      schemaIds: [],
    });
  });
});

describe('ClientConceptController.share', () => {
  it('не терапевт — 403, связь и база не трогаются', async () => {
    const { ctrl, relations, prisma } = makeController({ role: 'CLIENT' });
    await expect(ctrl.share(req, '7', { shared: true })).rejects.toThrow(
      ForbiddenException,
    );
    expect(relations.assertHasClient).not.toHaveBeenCalled();
    expect(prisma.clientConceptualization.upsert).not.toHaveBeenCalled();
  });

  it("чужой клиент ('No active relation') — 403, не 500", async () => {
    const { ctrl, prisma } = makeController({ relation: false });
    await expect(ctrl.share(req, '7', { shared: true })).rejects.toThrow(
      new ForbiddenException('No active relation with this client'),
    );
    expect(prisma.clientConceptualization.upsert).not.toHaveBeenCalled();
  });

  it('кривой id клиента — 400', async () => {
    const { ctrl } = makeController();
    await expect(ctrl.share(req, 'abc', { shared: true })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('свой клиент — момент показа в ответе', async () => {
    const { ctrl, relations } = makeController();
    const res = await ctrl.share(req, '7', { shared: true });
    expect(res.sharedWithClientAt).toBeInstanceOf(Date);
    expect(relations.assertHasClient).toHaveBeenCalledWith(42n, 7n);
  });
});
