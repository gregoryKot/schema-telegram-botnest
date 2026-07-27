// TherapyController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками — паттерн auth-2fa.controller.spec.ts
// (Pick<Service, 'method'> & { method: jest.Mock }, `as unknown as` только где
// неизбежно). Все хендлеры идут через приватный asTherapist(): роль != THERAPIST
// → 403 до вызова сервиса; ошибка сервиса 'No active relation' → 403, любая
// другая ошибка сервиса пробрасывается как есть (проверяем на одном хендлере,
// поведение общее для всех — asTherapist единственная точка).
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { TherapyController } from './therapy.controller';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';

type ClientDataMock = Pick<
  TherapyClientDataService,
  | 'requestYsq'
  | 'getClientDiaryEntries'
  | 'getClientSchemaNotes'
  | 'getClientModeNotes'
  | 'getClientHistory'
  | 'getClientData'
> & {
  requestYsq: jest.Mock;
  getClientDiaryEntries: jest.Mock;
  getClientSchemaNotes: jest.Mock;
  getClientModeNotes: jest.Mock;
  getClientHistory: jest.Mock;
  getClientData: jest.Mock;
};

type AccountMock = Pick<AccountService, 'getUserRole'> & {
  getUserRole: jest.Mock;
};

function makeClientData(): ClientDataMock {
  return {
    requestYsq: jest.fn().mockResolvedValue(undefined),
    getClientDiaryEntries: jest.fn().mockResolvedValue([{ id: 1 }]),
    getClientSchemaNotes: jest.fn().mockResolvedValue([{ id: 2 }]),
    getClientModeNotes: jest.fn().mockResolvedValue([{ id: 3 }]),
    getClientHistory: jest.fn().mockResolvedValue({ ratings: [] }),
    getClientData: jest.fn().mockResolvedValue({ ysq: null }),
  };
}

function makeAccount(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST'): AccountMock {
  return { getUserRole: jest.fn().mockResolvedValue(role) };
}

function makeReq(userId = 42n): Request {
  return { webUser: { userId } } as unknown as Request;
}

function makeController(opts: { account?: AccountMock } = {}) {
  const clientData = makeClientData();
  const account = opts.account ?? makeAccount();
  const controller = new TherapyController(
    clientData as unknown as TherapyClientDataService,
    account as unknown as AccountService,
  );
  return { controller, clientData, account };
}

describe('TherapyController.requestYsq', () => {
  it('не терапевт → ForbiddenException, сервис не вызывается', async () => {
    const { controller, clientData, account } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(controller.requestYsq(makeReq(1n), '5')).rejects.toThrow(
      ForbiddenException,
    );
    expect(clientData.requestYsq).not.toHaveBeenCalled();
    expect(account.getUserRole).toHaveBeenCalledWith(1n);
  });

  it('терапевт → делегирует requestYsq(therapistId, clientId) и возвращает { ok: true }', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.requestYsq(makeReq(7n), '5');
    expect(clientData.requestYsq).toHaveBeenCalledWith(7n, 5);
    expect(res).toEqual({ ok: true });
  });

  it('сервис бросает "No active relation" → ForbiddenException("No active relation with this client")', async () => {
    const { controller, clientData } = makeController();
    clientData.requestYsq.mockRejectedValue(new Error('No active relation'));
    await expect(controller.requestYsq(makeReq(7n), '5')).rejects.toThrow(
      'No active relation with this client',
    );
  });

  it('другая ошибка сервиса пробрасывается как есть (не превращается в 403)', async () => {
    const { controller, clientData } = makeController();
    clientData.requestYsq.mockRejectedValue(new Error('db exploded'));
    await expect(controller.requestYsq(makeReq(7n), '5')).rejects.toThrow(
      'db exploded',
    );
  });

  it('невалидный clientId ("abc") → BadRequestException до вызова сервиса', async () => {
    const { controller, clientData } = makeController();
    await expect(controller.requestYsq(makeReq(7n), 'abc')).rejects.toThrow(
      'Invalid id',
    );
    expect(clientData.requestYsq).not.toHaveBeenCalled();
  });

  it('отрицательный clientId (виртуальный офлайн-клиент) разрешён', async () => {
    const { controller, clientData } = makeController();
    await controller.requestYsq(makeReq(7n), '-3');
    expect(clientData.requestYsq).toHaveBeenCalledWith(7n, -3);
  });
});

describe('TherapyController.getClientDiary', () => {
  it('не терапевт → ForbiddenException', async () => {
    const { controller } = makeController({ account: makeAccount('CLIENT') });
    await expect(controller.getClientDiary(makeReq(1n), '5')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('терапевт → делегирует и возвращает результат сервиса', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.getClientDiary(makeReq(9n), '5');
    expect(clientData.getClientDiaryEntries).toHaveBeenCalledWith(9n, 5);
    expect(res).toEqual([{ id: 1 }]);
  });
});

describe('TherapyController.getClientSchemaNotes', () => {
  it('терапевт → делегирует getClientSchemaNotes(therapistId, clientId)', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.getClientSchemaNotes(makeReq(9n), '11');
    expect(clientData.getClientSchemaNotes).toHaveBeenCalledWith(9n, 11);
    expect(res).toEqual([{ id: 2 }]);
  });
});

describe('TherapyController.getClientModeNotes', () => {
  it('терапевт → делегирует getClientModeNotes(therapistId, clientId)', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.getClientModeNotes(makeReq(9n), '11');
    expect(clientData.getClientModeNotes).toHaveBeenCalledWith(9n, 11);
    expect(res).toEqual([{ id: 3 }]);
  });
});

describe('TherapyController.getClientHistory', () => {
  it('терапевт → делегирует getClientHistory(therapistId, clientId)', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.getClientHistory(makeReq(9n), '11');
    expect(clientData.getClientHistory).toHaveBeenCalledWith(9n, 11);
    expect(res).toEqual({ ratings: [] });
  });
});

describe('TherapyController.getClientData', () => {
  it('терапевт → делегирует getClientData(therapistId, clientId)', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.getClientData(makeReq(9n), '11');
    expect(clientData.getClientData).toHaveBeenCalledWith(9n, 11);
    expect(res).toEqual({ ysq: null });
  });

  it('No active relation → ForbiddenException', async () => {
    const { controller, clientData } = makeController();
    clientData.getClientData.mockRejectedValue(new Error('No active relation'));
    await expect(controller.getClientData(makeReq(9n), '11')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
