// TherapyConnectionController был на 0% покрытия. Инстанцируем напрямую (без
// Nest TestingModule) с типизированными двойниками зависимостей — паттерн
// auth-2fa.controller.spec.ts (Pick<Service, 'method'> & { method: jest.Mock }).
// Хендлеры проверяют роль THERAPIST инлайн (не через общий helper, в отличие
// от therapy.controller) — общий 403-guard проверен один раз таблично
// (roleGuardedRoutes), argument-passing и happy path — по каждому хендлеру.
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TherapyConnectionController } from './therapy-connection.controller';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';
import { TherapistRequestService } from './therapist-request.service';
import { SubmitTherapistRequestDto } from './therapist-request.dto';

type RelationsMock = Pick<
  TherapyRelationsService,
  | 'createInvite'
  | 'getRelation'
  | 'joinAsClient'
  | 'disconnect'
  | 'getClients'
  | 'addVirtualClient'
  | 'renameClient'
> & {
  createInvite: jest.Mock;
  getRelation: jest.Mock;
  joinAsClient: jest.Mock;
  disconnect: jest.Mock;
  getClients: jest.Mock;
  addVirtualClient: jest.Mock;
  renameClient: jest.Mock;
};

type ClientDataMock = Pick<TherapyClientDataService, 'removeClient'> & {
  removeClient: jest.Mock;
};

type AccountMock = Pick<
  AccountService,
  'getUserRole' | 'setTherapistMode' | 'resignTherapist'
> & {
  getUserRole: jest.Mock;
  setTherapistMode: jest.Mock;
  resignTherapist: jest.Mock;
};

type RequestSvcMock = Pick<TherapistRequestService, 'submit' | 'getMine'> & {
  submit: jest.Mock;
  getMine: jest.Mock;
};

function makeRelations(): RelationsMock {
  return {
    createInvite: jest
      .fn()
      .mockResolvedValue({ code: 'ABC123', url: 'https://t.me/x?startapp=y' }),
    getRelation: jest
      .fn()
      .mockResolvedValue({ role: 'client', status: 'active' }),
    joinAsClient: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getClients: jest.fn().mockResolvedValue([{ id: 1 }]),
    addVirtualClient: jest.fn().mockResolvedValue([{ id: 1 }, { id: -1 }]),
    renameClient: jest.fn().mockResolvedValue(undefined),
  };
}

function makeClientData(): ClientDataMock {
  return { removeClient: jest.fn().mockResolvedValue(undefined) };
}

function makeAccount(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST'): AccountMock {
  return {
    getUserRole: jest.fn().mockResolvedValue(role),
    setTherapistMode: jest.fn().mockResolvedValue(undefined),
    resignTherapist: jest.fn().mockResolvedValue(undefined),
  };
}

function makeRequestSvc(): RequestSvcMock {
  return {
    submit: jest.fn().mockResolvedValue({ id: 5, status: 'pending' }),
    getMine: jest.fn().mockResolvedValue(null),
  };
}

function makeReq(userId = 42n): Request {
  return { webUser: { userId } } as unknown as Request;
}

function makeController(
  opts: { account?: AccountMock; relations?: RelationsMock } = {},
) {
  const relations = opts.relations ?? makeRelations();
  const clientData = makeClientData();
  const account = opts.account ?? makeAccount();
  const requestSvc = makeRequestSvc();
  const controller = new TherapyConnectionController(
    relations as unknown as TherapyRelationsService,
    clientData as unknown as TherapyClientDataService,
    account as unknown as AccountService,
    requestSvc as unknown as TherapistRequestService,
  );
  return { controller, relations, clientData, account, requestSvc };
}

// Все эти хендлеры одинаково начинаются с getUserRole !== 'THERAPIST' → 403,
// до вызова доменного сервиса. Табличная проверка вместо 7 копипаст.
describe('TherapyConnectionController — 403 для не-терапевта', () => {
  const cases: Array<
    [string, (c: TherapyConnectionController) => Promise<unknown>]
  > = [
    ['createInvite', (c) => c.createInvite(makeReq())],
    ['getClients', (c) => c.getClients(makeReq())],
    ['removeClient', (c) => c.removeClient(makeReq(), '5')],
    ['addVirtualClient', (c) => c.addVirtualClient(makeReq(), { name: 'X' })],
    ['renameClient', (c) => c.renameClient(makeReq(), '5', { alias: 'X' })],
    ['setTherapistView', (c) => c.setTherapistView(makeReq(), { on: true })],
    ['resignTherapist', (c) => c.resignTherapist(makeReq())],
  ];

  it.each(cases)('%s → ForbiddenException для CLIENT', async (_name, call) => {
    const { controller } = makeController({ account: makeAccount('CLIENT') });
    await expect(call(controller)).rejects.toThrow(ForbiddenException);
  });
});

describe('TherapyConnectionController.createInvite', () => {
  it('терапевт → делегирует createInvite(therapistId) и возвращает результат', async () => {
    const { controller, relations } = makeController();
    const res = await controller.createInvite(makeReq(3n));
    expect(relations.createInvite).toHaveBeenCalledWith(3n);
    expect(res).toEqual({ code: 'ABC123', url: 'https://t.me/x?startapp=y' });
  });
});

describe('TherapyConnectionController.getRelation', () => {
  it('доступен любой роли → делегирует getRelation(userId)', async () => {
    const { controller, relations } = makeController({
      account: makeAccount('CLIENT'),
    });
    const res = await controller.getRelation(makeReq(11n));
    expect(relations.getRelation).toHaveBeenCalledWith(11n);
    expect(res).toEqual({ role: 'client', status: 'active' });
  });
});

describe('TherapyConnectionController.join', () => {
  it('пустой code → BadRequestException, joinAsClient не вызывается', async () => {
    const { controller, relations } = makeController();
    await expect(controller.join(makeReq(), { code: '' })).rejects.toThrow(
      BadRequestException,
    );
    expect(relations.joinAsClient).not.toHaveBeenCalled();
  });

  it('невалидный/просроченный код → BadRequestException("Invalid or expired code")', async () => {
    const { controller, relations } = makeController();
    relations.joinAsClient.mockResolvedValue(false);
    await expect(controller.join(makeReq(5n), { code: 'BAD' })).rejects.toThrow(
      'Invalid or expired code',
    );
    expect(relations.joinAsClient).toHaveBeenCalledWith(5n, 'BAD');
  });

  it('валидный код → { ok: true }', async () => {
    const { controller, relations } = makeController();
    const res = await controller.join(makeReq(5n), { code: 'GOOD' });
    expect(relations.joinAsClient).toHaveBeenCalledWith(5n, 'GOOD');
    expect(res).toEqual({ ok: true });
  });
});

describe('TherapyConnectionController.disconnect', () => {
  it('делегирует disconnect(userId) и возвращает { ok: true }', async () => {
    const { controller, relations } = makeController();
    const res = await controller.disconnect(makeReq(6n));
    expect(relations.disconnect).toHaveBeenCalledWith(6n);
    expect(res).toEqual({ ok: true });
  });
});

describe('TherapyConnectionController.getClients / removeClient', () => {
  it('getClients: терапевт → делегирует getClients(therapistId)', async () => {
    const { controller, relations } = makeController();
    const res = await controller.getClients(makeReq(3n));
    expect(relations.getClients).toHaveBeenCalledWith(3n);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('removeClient: терапевт → делегирует removeClient(therapistId, clientId)', async () => {
    const { controller, clientData } = makeController();
    const res = await controller.removeClient(makeReq(3n), '9');
    expect(clientData.removeClient).toHaveBeenCalledWith(3n, 9);
    expect(res).toEqual({ ok: true });
  });
});

describe('TherapyConnectionController.addVirtualClient', () => {
  it('пустое имя → BadRequestException, сервис не вызывается', async () => {
    const { controller, relations } = makeController();
    await expect(
      controller.addVirtualClient(makeReq(3n), { name: '   ' }),
    ).rejects.toThrow(BadRequestException);
    expect(relations.addVirtualClient).not.toHaveBeenCalled();
  });

  it('валидное имя → делегирует addVirtualClient(therapistId, name)', async () => {
    const { controller, relations } = makeController();
    const res = await controller.addVirtualClient(makeReq(3n), {
      name: 'Иван',
    });
    expect(relations.addVirtualClient).toHaveBeenCalledWith(3n, 'Иван');
    expect(res).toEqual([{ id: 1 }, { id: -1 }]);
  });
});

describe('TherapyConnectionController.addClientManually', () => {
  it('всегда → ForbiddenException (ручное добавление реальных клиентов отключено)', () => {
    const { controller } = makeController();
    expect(() =>
      controller.addClientManually(makeReq(3n), { clientTelegramId: 123 }),
    ).toThrow(ForbiddenException);
  });
});

describe('TherapyConnectionController.renameClient', () => {
  it('терапевт → делегирует renameClient(therapistId, clientId, alias)', async () => {
    const { controller, relations } = makeController();
    const res = await controller.renameClient(makeReq(3n), '5', {
      alias: 'Клиент А',
    });
    expect(relations.renameClient).toHaveBeenCalledWith(3n, 5, 'Клиент А');
    expect(res).toEqual({ ok: true });
  });
});

describe('TherapyConnectionController.becomeTherapist', () => {
  it('всегда 410 Gone (deprecated route)', () => {
    const { controller } = makeController();
    let caught: unknown;
    try {
      controller.becomeTherapist();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(410);
  });
});

describe('TherapyConnectionController.submitRequest / getMyRequest', () => {
  it('submitRequest: делегирует submit(userId, dto) и возвращает результат', async () => {
    const { controller, requestSvc } = makeController();
    const dto: SubmitTherapistRequestDto = {
      fullName: 'Имя Фамилия',
      qualification: 'Психолог',
      contacts: '@user',
    };
    const res = await controller.submitRequest(makeReq(3n), dto);
    expect(requestSvc.submit).toHaveBeenCalledWith(3n, dto);
    expect(res).toEqual({ id: 5, status: 'pending' });
  });

  it('getMyRequest: нет заявки → возвращает null (не undefined)', async () => {
    const { controller, requestSvc } = makeController();
    const res = await controller.getMyRequest(makeReq(3n));
    expect(requestSvc.getMine).toHaveBeenCalledWith(3n);
    expect(res).toBeNull();
  });

  it('getMyRequest: есть заявка → возвращает её как есть', async () => {
    const { controller, requestSvc } = makeController();
    requestSvc.getMine.mockResolvedValue({ id: 1, status: 'pending' });
    const res = await controller.getMyRequest(makeReq(3n));
    expect(res).toEqual({ id: 1, status: 'pending' });
  });
});

describe('TherapyConnectionController.setTherapistView / resignTherapist', () => {
  it('setTherapistView: терапевт → делегирует setTherapistMode(userId, on)', async () => {
    const { controller, account } = makeController();
    const res = await controller.setTherapistView(makeReq(3n), { on: false });
    expect(account.setTherapistMode).toHaveBeenCalledWith(3n, false);
    expect(res).toEqual({ ok: true });
  });

  it('resignTherapist: терапевт → делегирует resignTherapist(userId)', async () => {
    const { controller, account } = makeController();
    const res = await controller.resignTherapist(makeReq(3n));
    expect(account.resignTherapist).toHaveBeenCalledWith(3n);
    expect(res).toEqual({ ok: true });
  });
});
