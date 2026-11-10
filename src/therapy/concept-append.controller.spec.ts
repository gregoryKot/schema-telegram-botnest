// POST /api/therapy/conceptualization/:clientId/append (#963): роль ≠
// THERAPIST → 403 до чтения связи; чужой клиент ('No active relation') →
// 403, а не 500; кривой id → 400; свой клиент — ответ объединения.
// Инстанцируем напрямую, как therapy-notes.controller.spec.ts.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConceptAppendController } from './concept-append.controller';
import type { AuthRequest } from '../api/request-utils';

function makeController(opts: { role?: string; relation?: boolean } = {}) {
  const row = { modeIds: '[]', schemaIds: '[]', modeLinks: '[]', history: [] };
  const tx = {
    clientConceptualization: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(row),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
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
  const ctrl = new ConceptAppendController(
    prisma as never,
    relations as never,
    account as never,
  );
  return { ctrl, prisma, relations, tx };
}

const req = { webUser: { userId: 42n } } as AuthRequest;

describe('ConceptAppendController.append', () => {
  it('не терапевт — 403, связь и база не трогаются', async () => {
    const { ctrl, relations, prisma } = makeController({ role: 'CLIENT' });
    await expect(ctrl.append(req, '7', { modeIds: ['x'] })).rejects.toThrow(
      ForbiddenException,
    );
    expect(relations.assertHasClient).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("чужой клиент ('No active relation') — 403, не 500", async () => {
    const { ctrl, prisma } = makeController({ relation: false });
    await expect(ctrl.append(req, '7', { modeIds: ['x'] })).rejects.toThrow(
      new ForbiddenException('No active relation with this client'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('кривой id клиента — 400', async () => {
    const { ctrl } = makeController();
    await expect(ctrl.append(req, 'abc', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('свой клиент (и офлайн-клиент с минусом) — объединение пишется', async () => {
    const { ctrl, relations, tx } = makeController();
    await ctrl.append(req, '-57', { modeIds: ['healthy_adult'] });
    expect(relations.assertHasClient).toHaveBeenCalledWith(42n, -57n);
    expect(tx.clientConceptualization.upsert).toHaveBeenCalledTimes(1);
    expect(tx.clientConceptualization.upsert.mock.calls[0][0].where).toEqual({
      therapistId_clientId: { therapistId: 42n, clientId: -57n },
    });
  });

  it('линии к потребностям (schemaLinks) доходят до записи вместе со схемой', async () => {
    const { ctrl, tx } = makeController();
    await ctrl.append(req, '7', {
      schemaLinks: [{ schemaId: 'defectiveness', needIds: ['play'] }],
    });
    const { create } = tx.clientConceptualization.upsert.mock.calls[0][0];
    expect(typeof create.schemaLinks).toBe('string');
    expect(create.schemaLinks).not.toBe('[]');
    expect(typeof create.schemaIds).toBe('string'); // без схем — [] массивом
  });
});
