// TherapyConnectionController был на 0% покрытия. Инстанцируем напрямую (без
// Nest TestingModule) с типизированными двойниками зависимостей — паттерн
// auth-2fa.controller.spec.ts (Pick<Service, 'method'> & { method: jest.Mock }).
// Хендлеры проверяют роль THERAPIST общим assertTherapist — 403-guard
// проверен один раз таблично, argument-passing и happy path — по каждому хендлеру.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TherapyConnectionController } from './therapy-connection.controller';
import { TherapyRelationsService } from './therapy-relations.service';
import {
  ALREADY_CONNECTED_ERROR,
  TOO_MANY_INVITES_ERROR,
} from './therapy-invite';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';
import { TherapistRequestService } from './therapist-request.service';
import { TherapistExitService } from './therapist-exit.service';
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

type AccountMock = Pick<AccountService, 'getUserRole' | 'setTherapistMode'> & {
  getUserRole: jest.Mock;
  setTherapistMode: jest.Mock;
};

type ExitMock = Pick<TherapistExitService, 'resign' | 'formerTherapist'> & {
  resign: jest.Mock;
  formerTherapist: jest.Mock;
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
  };
}

function makeExit(): ExitMock {
  return {
    resign: jest.fn().mockResolvedValue(undefined),
    formerTherapist: jest
      .fn()
      .mockResolvedValue({ name: 'Анна', endedAt: '2026-10-22T10:00:00.000Z' }),
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
  const exit = makeExit();
  const controller = new TherapyConnectionController(
    relations as unknown as TherapyRelationsService,
    clientData as unknown as TherapyClientDataService,
    account as unknown as AccountService,
    requestSvc as unknown as TherapistRequestService,
    exit as unknown as TherapistExitService,
  );
  return { controller, relations, clientData, account, requestSvc, exit };
}

// Все эти хендлеры одинаково начинаются с getUserRole !== 'THERAPIST' → 403,
// до вызова доменного сервиса. Табличная проверка вместо 7 копипаст.
describe('TherapyConnectionController — 403 для не-терапевта', () => {
  const cases: Array<
    [string, (c: TherapyConnectionController) => Promise<unknown>]
  > = [
    ['createInvite', (c) => c.createInvite(makeReq(), {})],
    ['getClients', (c) => c.getClients(makeReq())],
    ['removeClient', (c) => c.removeClient(makeReq(), '5')],
    ['addVirtualClient', (c) => c.addVirtualClient(makeReq(), { name: 'X' })],
    ['renameClient', (c) => c.renameClient(makeReq(), '5', { alias: 'X' })],
    ['setTherapistView', (c) => c.setTherapistView(makeReq(), { on: true })],
    ['resignTherapist', (c) => c.resignTherapist(makeReq())],
  ];

  it.each(cases)('%s → ForbiddenException для CLIENT', async (_name, call) => {
    const { controller, exit } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(call(controller)).rejects.toThrow(ForbiddenException);
    expect(exit.resign).not.toHaveBeenCalled();
  });
});

describe('TherapyConnectionController.createInvite', () => {
  it('терапевт → делегирует createInvite(therapistId, alias) и возвращает результат', async () => {
    const { controller, relations } = makeController();
    const res = await controller.createInvite(makeReq(3n), {
      alias: 'Мария К.',
    });
    expect(relations.createInvite).toHaveBeenCalledWith(3n, 'Мария К.');
    expect(res).toEqual({ code: 'ABC123', url: 'https://t.me/x?startapp=y' });
  });

  it('без имени (настройки «Кабинет») → alias undefined', async () => {
    const { controller, relations } = makeController();
    await controller.createInvite(makeReq(3n), {});
    expect(relations.createInvite).toHaveBeenCalledWith(3n, undefined);
  });

  it('предел живых приглашений → 409 { reason: too_many_invites }', async () => {
    const relations = makeRelations();
    relations.createInvite.mockRejectedValue(new Error(TOO_MANY_INVITES_ERROR));
    const { controller } = makeController({ relations });
    const err = await controller
      .createInvite(makeReq(3n), {})
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      reason: 'too_many_invites',
    });
  });

  it('прочая ошибка пробрасывается как есть', async () => {
    const relations = makeRelations();
    relations.createInvite.mockRejectedValue(new Error('db down'));
    const { controller } = makeController({ relations });
    await expect(controller.createInvite(makeReq(3n), {})).rejects.toThrow(
      'db down',
    );
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

describe('TherapyConnectionController.getFormerTherapist', () => {
  it('доступен любой роли → отдаёт бывшего терапевта текущего пользователя', async () => {
    const { controller, exit } = makeController({
      account: makeAccount('CLIENT'),
    });
    const res = await controller.getFormerTherapist(makeReq(11n));
    expect(exit.formerTherapist).toHaveBeenCalledWith(11n);
    expect(res).toEqual({ name: 'Анна', endedAt: '2026-10-22T10:00:00.000Z' });
  });

  it('бывшего терапевта нет → null как есть', async () => {
    const { controller, exit } = makeController();
    exit.formerTherapist.mockResolvedValue(null);
    expect(await controller.getFormerTherapist(makeReq(12n))).toBeNull();
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

  // Аудит 2026-10, T3: уже есть связь с другим терапевтом → 409 с причиной
  // (не 400 «неверный код» и не тихий успех).
  it('связь с другим терапевтом → 409 с reason: already_connected', async () => {
    const { controller, relations } = makeController();
    relations.joinAsClient.mockRejectedValue(
      new Error(ALREADY_CONNECTED_ERROR),
    );
    const err = await controller
      .join(makeReq(5n), { code: 'GOOD' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      reason: 'already_connected',
    });
  });

  it('неизвестная ошибка сервиса пробрасывается как есть (не маскируется под 409)', async () => {
    const { controller, relations } = makeController();
    relations.joinAsClient.mockRejectedValue(new Error('db down'));
    await expect(
      controller.join(makeReq(5n), { code: 'GOOD' }),
    ).rejects.toThrow('db down');
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
    expect(clientData.removeClient).toHaveBeenCalledWith(3n, 9n);
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

describe('TherapyConnectionController.renameClient', () => {
  it('терапевт → делегирует renameClient(therapistId, clientId, alias)', async () => {
    const { controller, relations } = makeController();
    const res = await controller.renameClient(makeReq(3n), '5', {
      alias: 'Клиент А',
    });
    expect(relations.renameClient).toHaveBeenCalledWith(3n, 5n, 'Клиент А');
    expect(res).toEqual({ ok: true });
  });

  // QA 2026-10-26: переименование удалённого офлайн-клиента отвечало 201.
  it('связи нет (удалён/чужой) → 403, как у соседних ручек с :clientId', async () => {
    const { controller, relations } = makeController();
    relations.renameClient.mockRejectedValueOnce(
      new Error('No active relation'),
    );
    await expect(
      controller.renameClient(makeReq(3n), '-142', { alias: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(relations.renameClient).toHaveBeenCalledWith(3n, -142n, 'X');
  });

  it('прочая ошибка сервиса не маскируется под 403', async () => {
    const { controller, relations } = makeController();
    relations.renameClient.mockRejectedValueOnce(new Error('db down'));
    await expect(
      controller.renameClient(makeReq(3n), '5', { alias: 'X' }),
    ).rejects.toThrow('db down');
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

  it('resignTherapist: терапевт → делегирует TherapistExitService.resign(userId)', async () => {
    const { controller, exit } = makeController();
    const res = await controller.resignTherapist(makeReq(3n));
    expect(exit.resign).toHaveBeenCalledWith(3n);
    expect(res).toEqual({ ok: true });
  });
});
