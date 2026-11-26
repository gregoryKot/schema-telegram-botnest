// TherapyInvitesController (инцидент 2026-10-26): список живых приглашений —
// только терапевту; отзыв — со скоупом по владельцу (его держит сервис, здесь —
// что id из пути разбирается строго и «не нашлось» — 404); предпросмотр —
// 400 на негодный код, имя терапевта на живой.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TOO_MANY_INVITES_ERROR } from './therapy-invite';
import { TherapyInvitesController } from './therapy-invites.controller';
import type { TherapyInviteService } from './therapy-invite.service';
import type { AccountService } from '../bot/account.service';
import type { AuthRequest } from '../api/request-utils';

function make(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST') {
  const relations = {
    list: jest.fn().mockResolvedValue([{ id: 1, code: 'AAAAAAAAAAAA' }]),
    revoke: jest.fn().mockResolvedValue(true),
    preview: jest.fn().mockResolvedValue({ therapistName: 'Анна' }),
    createFromCard: jest
      .fn()
      .mockResolvedValue({ code: 'AAAAAAAAAAAA', url: 'https://t.me/x' }),
  };
  const account = { getUserRole: jest.fn().mockResolvedValue(role) };
  const controller = new TherapyInvitesController(
    relations as unknown as TherapyInviteService,
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
    expect(relations.list).toHaveBeenCalledWith(3n);
  });

  it('не терапевт — 403, сервис не зовётся', async () => {
    const { controller, relations } = make('CLIENT');
    await expect(controller.list(req())).rejects.toThrow(ForbiddenException);
    expect(relations.list).not.toHaveBeenCalled();
  });
});

describe('TherapyInvitesController.revoke', () => {
  it('своё приглашение → { ok: true }, id из пути числом', async () => {
    const { controller, relations } = make();
    await expect(controller.revoke(req(3n), '12')).resolves.toEqual({
      ok: true,
    });
    expect(relations.revoke).toHaveBeenCalledWith(3n, 12);
  });

  it('не нашлось (чужое, принятое, уже отозванное) → 404', async () => {
    const { controller, relations } = make();
    relations.revoke.mockResolvedValue(false);
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
    expect(relations.revoke).not.toHaveBeenCalled();
  });
});

describe('TherapyInvitesController.preview', () => {
  it('живой код → имя терапевта; доступно любой роли', async () => {
    const { controller, relations } = make('CLIENT');
    await expect(
      controller.preview(req(5n), { code: 'aaaaaaaaaaaa' }),
    ).resolves.toEqual({ therapistName: 'Анна' });
    expect(relations.preview).toHaveBeenCalledWith(5n, 'aaaaaaaaaaaa');
  });

  it('негодный код → 400 с тем же текстом, что у подключения', async () => {
    const { controller, relations } = make('CLIENT');
    relations.preview.mockResolvedValue(null);
    await expect(controller.preview(req(), { code: 'ZZZ' })).rejects.toThrow(
      'Invalid or expired code',
    );
  });
});

describe('TherapyInvitesController.createFromCard', () => {
  it('терапевт, офлайн-id → { code, url }', async () => {
    const { controller, relations } = make();
    await expect(controller.createFromCard(req(3n), '-5')).resolves.toEqual({
      code: 'AAAAAAAAAAAA',
      url: 'https://t.me/x',
    });
    expect(relations.createFromCard).toHaveBeenCalledWith(3n, -5n);
  });

  it('положительный id → 400, сервис не зовётся', async () => {
    const { controller, relations } = make();
    await expect(controller.createFromCard(req(), '5')).rejects.toThrow(
      BadRequestException,
    );
    expect(relations.createFromCard).not.toHaveBeenCalled();
  });

  it('не терапевт → 403', async () => {
    const { controller, relations } = make('CLIENT');
    await expect(controller.createFromCard(req(), '-5')).rejects.toThrow(
      ForbiddenException,
    );
    expect(relations.createFromCard).not.toHaveBeenCalled();
  });

  it('No active relation → 403', async () => {
    const { controller, relations } = make();
    relations.createFromCard.mockRejectedValue(new Error('No active relation'));
    await expect(controller.createFromCard(req(), '-5')).rejects.toThrow(
      'No active relation with this client',
    );
  });

  it('предел живых приглашений → 409 too_many_invites', async () => {
    const { controller, relations } = make();
    relations.createFromCard.mockRejectedValue(
      new Error(TOO_MANY_INVITES_ERROR),
    );
    await expect(controller.createFromCard(req(), '-5')).rejects.toThrow(
      ConflictException,
    );
  });
});
