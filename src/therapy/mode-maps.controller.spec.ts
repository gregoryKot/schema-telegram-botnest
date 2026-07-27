// ModeMapsController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками — паттерн auth-2fa.controller.spec.ts
// (Pick<Service, 'method'> & { method: jest.Mock }). Особый акцент — регресс
// PR #66: доступ терапевта к карте режимов ПОСЛЕ разрыва связи с клиентом
// (сервис бросает 'No active relation' — вторая линия защиты сверх owner-check
// по mapId) должен маппиться в 403, а не падать 500 непойманной ошибкой.
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ModeMapsController } from './mode-maps.controller';
import { ModeMapsService } from './mode-maps.service';
import { AccountService } from '../bot/account.service';

type ModeMapsMock = Pick<
  ModeMapsService,
  | 'listCustomModes'
  | 'createCustomMode'
  | 'deleteCustomMode'
  | 'listModeMaps'
  | 'getModeMap'
  | 'createModeMap'
  | 'updateModeMap'
  | 'deleteModeMap'
  | 'listMyModeMaps'
  | 'getMyModeMap'
> & {
  listCustomModes: jest.Mock;
  createCustomMode: jest.Mock;
  deleteCustomMode: jest.Mock;
  listModeMaps: jest.Mock;
  getModeMap: jest.Mock;
  createModeMap: jest.Mock;
  updateModeMap: jest.Mock;
  deleteModeMap: jest.Mock;
  listMyModeMaps: jest.Mock;
  getMyModeMap: jest.Mock;
};

type AccountMock = Pick<AccountService, 'getUserRole'> & {
  getUserRole: jest.Mock;
};

function makeModeMaps(): ModeMapsMock {
  return {
    listCustomModes: jest.fn().mockResolvedValue([{ id: 1, name: 'Критик' }]),
    createCustomMode: jest.fn().mockResolvedValue({ id: 2, name: 'Ребёнок' }),
    deleteCustomMode: jest.fn().mockResolvedValue(undefined),
    listModeMaps: jest.fn().mockResolvedValue([{ id: 1, title: 'Карта' }]),
    getModeMap: jest.fn().mockResolvedValue({ id: 1, nodes: [], edges: [] }),
    createModeMap: jest
      .fn()
      .mockResolvedValue({ id: 3, title: 'Карта режимов' }),
    updateModeMap: jest.fn().mockResolvedValue({ id: 1, title: 'Обновлена' }),
    deleteModeMap: jest.fn().mockResolvedValue(undefined),
    listMyModeMaps: jest.fn().mockResolvedValue([{ id: 1 }]),
    getMyModeMap: jest.fn().mockResolvedValue({ id: 1, nodes: [] }),
  };
}

function makeAccount(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST'): AccountMock {
  return { getUserRole: jest.fn().mockResolvedValue(role) };
}

function makeReq(userId = 42n): Request {
  return { webUser: { userId } } as unknown as Request;
}

function makeController(opts: { account?: AccountMock } = {}) {
  const modeMaps = makeModeMaps();
  const account = opts.account ?? makeAccount();
  const controller = new ModeMapsController(
    modeMaps as unknown as ModeMapsService,
    account as unknown as AccountService,
  );
  return { controller, modeMaps, account };
}

describe('ModeMapsController.listCustomModes / createCustomMode / deleteCustomMode', () => {
  it('listCustomModes: не терапевт → ForbiddenException', async () => {
    const { controller } = makeController({ account: makeAccount('CLIENT') });
    await expect(controller.listCustomModes(makeReq())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('listCustomModes: терапевт → делегирует listCustomModes(therapistId)', async () => {
    const { controller, modeMaps } = makeController();
    const res = await controller.listCustomModes(makeReq(3n));
    expect(modeMaps.listCustomModes).toHaveBeenCalledWith(3n);
    expect(res).toEqual([{ id: 1, name: 'Критик' }]);
  });

  it('createCustomMode: пустое имя → BadRequestException, сервис не вызывается', async () => {
    const { controller, modeMaps } = makeController();
    await expect(
      controller.createCustomMode(makeReq(3n), { name: '  ' }),
    ).rejects.toThrow(BadRequestException);
    expect(modeMaps.createCustomMode).not.toHaveBeenCalled();
  });

  it('createCustomMode: валидное имя → делегирует createCustomMode(therapistId, body)', async () => {
    const { controller, modeMaps } = makeController();
    const body = { name: 'Ребёнок', emoji: '👶' };
    const res = await controller.createCustomMode(makeReq(3n), body);
    expect(modeMaps.createCustomMode).toHaveBeenCalledWith(3n, body);
    expect(res).toEqual({ id: 2, name: 'Ребёнок' });
  });

  it('deleteCustomMode: терапевт → делегирует deleteCustomMode(therapistId, modeId)', async () => {
    const { controller, modeMaps } = makeController();
    const res = await controller.deleteCustomMode(makeReq(3n), '9');
    expect(modeMaps.deleteCustomMode).toHaveBeenCalledWith(3n, 9);
    expect(res).toEqual({ ok: true });
  });
});

describe('ModeMapsController.listModeMaps', () => {
  it('не терапевт → ForbiddenException', async () => {
    const { controller } = makeController({ account: makeAccount('CLIENT') });
    await expect(controller.listModeMaps(makeReq(), '5')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('терапевт → делегирует listModeMaps(therapistId, clientId)', async () => {
    const { controller, modeMaps } = makeController();
    const res = await controller.listModeMaps(makeReq(3n), '5');
    expect(modeMaps.listModeMaps).toHaveBeenCalledWith(3n, 5);
    expect(res).toEqual([{ id: 1, title: 'Карта' }]);
  });

  it('No active relation → ForbiddenException', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.listModeMaps.mockRejectedValue(new Error('No active relation'));
    await expect(controller.listModeMaps(makeReq(3n), '5')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('ModeMapsController.getModeMap — регресс PR #66', () => {
  it('терапевт → делегирует getModeMap(therapistId, mapId) и возвращает карту', async () => {
    const { controller, modeMaps } = makeController();
    const res = await controller.getModeMap(makeReq(3n), '7');
    expect(modeMaps.getModeMap).toHaveBeenCalledWith(3n, 7);
    expect(res).toEqual({ id: 1, nodes: [], edges: [] });
  });

  it('карта чужая/не найдена ("Not found") → 403, не 500', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.getModeMap.mockRejectedValue(new Error('Not found'));
    await expect(controller.getModeMap(makeReq(3n), '7')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('связь с клиентом разорвана после создания карты ("No active relation") → 403, не 500', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.getModeMap.mockRejectedValue(new Error('No active relation'));
    await expect(controller.getModeMap(makeReq(3n), '7')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('непредвиденная ошибка сервиса пробрасывается как есть (не глотается в 403)', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.getModeMap.mockRejectedValue(new Error('db exploded'));
    await expect(controller.getModeMap(makeReq(3n), '7')).rejects.toThrow(
      'db exploded',
    );
  });
});

describe('ModeMapsController.createModeMap', () => {
  it('без title → сервис получает дефолт "Карта режимов"', async () => {
    const { controller, modeMaps } = makeController();
    await controller.createModeMap(makeReq(3n), '5', {});
    expect(modeMaps.createModeMap).toHaveBeenCalledWith(
      3n,
      5,
      'Карта режимов',
      undefined,
    );
  });

  it('длинный title обрезается до 120 символов', async () => {
    const { controller, modeMaps } = makeController();
    const longTitle = 'а'.repeat(200);
    await controller.createModeMap(makeReq(3n), '5', { title: longTitle });
    const passedTitle = modeMaps.createModeMap.mock.calls[0][2] as string;
    expect(passedTitle).toHaveLength(120);
  });

  it('No active relation → ForbiddenException', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.createModeMap.mockRejectedValue(new Error('No active relation'));
    await expect(
      controller.createModeMap(makeReq(3n), '5', {}),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('ModeMapsController.updateModeMap / deleteModeMap', () => {
  it('updateModeMap: терапевт → делегирует updateModeMap(therapistId, mapId, body)', async () => {
    const { controller, modeMaps } = makeController();
    const body = { title: 'Новое имя' };
    const res = await controller.updateModeMap(makeReq(3n), '7', body);
    expect(modeMaps.updateModeMap).toHaveBeenCalledWith(3n, 7, body);
    expect(res).toEqual({ id: 1, title: 'Обновлена' });
  });

  it('updateModeMap: связь разорвана → 403, не 500', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.updateModeMap.mockRejectedValue(new Error('No active relation'));
    await expect(
      controller.updateModeMap(makeReq(3n), '7', {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deleteModeMap: терапевт → делегирует deleteModeMap(therapistId, mapId) и возвращает { ok: true }', async () => {
    const { controller, modeMaps } = makeController();
    const res = await controller.deleteModeMap(makeReq(3n), '7');
    expect(modeMaps.deleteModeMap).toHaveBeenCalledWith(3n, 7);
    expect(res).toEqual({ ok: true });
  });

  it('deleteModeMap: связь разорвана → 403, не 500', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.deleteModeMap.mockRejectedValue(new Error('No active relation'));
    await expect(controller.deleteModeMap(makeReq(3n), '7')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('ModeMapsController.listMyModeMaps / getMyModeMap', () => {
  it('listMyModeMaps: доступен клиенту (не только терапевту) → делегирует listMyModeMaps(userId)', async () => {
    const { controller, modeMaps } = makeController({
      account: makeAccount('CLIENT'),
    });
    const res = await controller.listMyModeMaps(makeReq(9n));
    expect(modeMaps.listMyModeMaps).toHaveBeenCalledWith(9n);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('getMyModeMap: делегирует getMyModeMap(userId, mapId)', async () => {
    const { controller, modeMaps } = makeController({
      account: makeAccount('CLIENT'),
    });
    const res = await controller.getMyModeMap(makeReq(9n), '4');
    expect(modeMaps.getMyModeMap).toHaveBeenCalledWith(9n, 4);
    expect(res).toEqual({ id: 1, nodes: [] });
  });

  it('getMyModeMap: чужая карта ("Not found") → ForbiddenException, не 500', async () => {
    const { controller, modeMaps } = makeController();
    modeMaps.getMyModeMap.mockRejectedValue(new Error('Not found'));
    await expect(controller.getMyModeMap(makeReq(9n), '4')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
