// TherapyInvitesController (инцидент 2026-10-26): список живых приглашений —
// только терапевту; отзыв — со скоупом по владельцу (его держит сервис, здесь —
// что id из пути разбирается строго и «не нашлось» — 404); предпросмотр —
// 400 на негодный код, имя терапевта на живой.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TherapyInvitesController } from './therapy-invites.controller';
import type { TherapyRelationsService } from './therapy-relations.service';
import type { AccountService } from '../bot/account.service';
import type { AuthRequest } from '../api/request-utils';

function make(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST') {
  const relations = {
    listInvites: jest.fn().mockResolvedValue([{ id: 1, code: 'AAAAAAAAAAAA' }]),
    revokeInvite: jest.fn().mockResolvedValue(true),
    previewInvite: jest.fn().mockResolvedValue({ therapistName: 'Анна' }),
  };
  const account = { getUserRole: jest.fn().mockResolvedValue(role) };
  const controller = new TherapyInvitesController(
    relations as unknown as TherapyRelationsService,
    account as unknown as AccountService,
  );
  return { controller, relations };
}

const req = (userId = 7n) => ({ webUser: { userId } }) as AuthRequest;

describe('TherapyInvitesController.list', () => {
  it('терапевт получает свои приглашения', async () => {
    const { controller, relations } = make();
    await expect(controller.list(req(3n))).resolves.toEqual([
      { id: 1, code: 'AAAAAAAAAAAA' },
    ]);
    expect(relations.listInvites).toHaveBeenCalledWith(3n);
  });

  it('не терапевт — 403, сервис не зовётся', async () => {
    const { controller, relations } = make('CLIENT');
    await expect(controller.list(req())).rejects.toThrow(ForbiddenException);
    expect(relations.listInvites).not.toHaveBeenCalled();
  });
});

describe('TherapyInvitesController.revoke', () => {
  it('своё приглашение → { ok: true }, id из пути числом', async () => {
    const { controller, relations } = make();
    await expect(controller.revoke(req(3n), '12')).resolves.toEqual({
      ok: true,
    });
    expect(relations.revokeInvite).toHaveBeenCalledWith(3n, 12);
  });

  it('не нашлось (чужое, принятое, уже отозванное) → 404', async () => {
    const { controller, relations } = make();
    relations.revokeInvite.mockResolvedValue(false);
    await expect(controller.revoke(req(), '12')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('мусор, отрицательный и не влезающий в Int id → 400 до сервиса', async () => {
    const { controller, relations } = make();
    for (const bad of ['abc', '-3', '1e3', '99999999999'])
      await expect(controller.revoke(req(), bad)).rejects.toThrow(
        BadRequestException,
      );
    expect(relations.revokeInvite).not.toHaveBeenCalled();
  });
});

describe('TherapyInvitesController.preview', () => {
  it('живой код → имя терапевта; доступно любой роли', async () => {
    const { controller, relations } = make('CLIENT');
    await expect(
      controller.preview(req(5n), { code: 'aaaaaaaaaaaa' }),
    ).resolves.toEqual({ therapistName: 'Анна' });
    expect(relations.previewInvite).toHaveBeenCalledWith(5n, 'aaaaaaaaaaaa');
  });

  it('негодный код → 400 с тем же текстом, что у подключения', async () => {
    const { controller, relations } = make('CLIENT');
    relations.previewInvite.mockResolvedValue(null);
    await expect(controller.preview(req(), { code: 'ZZZ' })).rejects.toThrow(
      'Invalid or expired code',
    );
  });
});
