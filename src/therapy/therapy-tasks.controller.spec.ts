// TherapyTasksController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками — паттерн auth-2fa.controller.spec.ts
// (Pick<Service, 'method'> & { method: jest.Mock }). Особое внимание —
// createTask: SECURITY-инвариант "терапевт может создать задачу клиенту
// только при реальной активной связи" (assertHasClient) и условная нотификация
// (только для реальных, не виртуальных, клиентов).
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { TherapyTasksController } from './therapy-tasks.controller';
import { TherapyRelationsService } from './therapy-relations.service';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { AccountService } from '../bot/account.service';

type RelationsMock = Pick<TherapyRelationsService, 'assertHasClient'> & {
  assertHasClient: jest.Mock;
};

type TasksMock = Pick<
  TherapyTasksService,
  | 'createTask'
  | 'getTasks'
  | 'getTaskHistory'
  | 'completeTask'
  | 'scheduleTaskNotification'
> & {
  createTask: jest.Mock;
  getTasks: jest.Mock;
  getTaskHistory: jest.Mock;
  completeTask: jest.Mock;
  scheduleTaskNotification: jest.Mock;
};

type TasksViewMock = Pick<
  TherapyTasksViewService,
  'getAllTasksForTherapist' | 'getTasksForClient'
> & {
  getAllTasksForTherapist: jest.Mock;
  getTasksForClient: jest.Mock;
};

type AccountMock = Pick<AccountService, 'getUserRole'> & {
  getUserRole: jest.Mock;
};

function makeRelations(): RelationsMock {
  return { assertHasClient: jest.fn().mockResolvedValue(undefined) };
}

function makeTasks(): TasksMock {
  return {
    createTask: jest.fn().mockResolvedValue({ id: 1, text: 'задача' }),
    getTasks: jest.fn().mockResolvedValue([{ id: 1 }]),
    getTaskHistory: jest.fn().mockResolvedValue([{ id: 2 }]),
    completeTask: jest.fn().mockResolvedValue(true),
    scheduleTaskNotification: jest.fn().mockResolvedValue(undefined),
  };
}

function makeTasksView(): TasksViewMock {
  return {
    getAllTasksForTherapist: jest.fn().mockResolvedValue([{ clientId: 1 }]),
    getTasksForClient: jest.fn().mockResolvedValue([{ id: 3 }]),
  };
}

function makeAccount(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST'): AccountMock {
  return { getUserRole: jest.fn().mockResolvedValue(role) };
}

function makeReq(userId = 42n): Request {
  return { webUser: { userId } } as unknown as Request;
}

function makeController(
  opts: { account?: AccountMock; relations?: RelationsMock } = {},
) {
  const relations = opts.relations ?? makeRelations();
  const tasks = makeTasks();
  const tasksView = makeTasksView();
  const account = opts.account ?? makeAccount();
  const controller = new TherapyTasksController(
    relations as unknown as TherapyRelationsService,
    tasks as unknown as TherapyTasksService,
    tasksView as unknown as TherapyTasksViewService,
    account as unknown as AccountService,
  );
  return { controller, relations, tasks, tasksView, account };
}

describe('TherapyTasksController.createTask', () => {
  it('без clientId → своя задача, assignedBy не выставляется, нотификация не шлётся', async () => {
    const { controller, tasks, relations } = makeController();
    const body = { type: 'custom', text: 'моя задача' };
    const res = await controller.createTask(makeReq(7n), body);
    expect(relations.assertHasClient).not.toHaveBeenCalled();
    expect(tasks.createTask).toHaveBeenCalledWith(7n, body, undefined);
    expect(tasks.scheduleTaskNotification).not.toHaveBeenCalled();
    expect(res).toEqual({ id: 1, text: 'задача' });
  });

  it('с clientId, не терапевт → ForbiddenException, createTask не вызывается', async () => {
    const { controller, tasks } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(
      controller.createTask(makeReq(7n), { type: 'x', text: 'y', clientId: 5 }),
    ).rejects.toThrow(ForbiddenException);
    expect(tasks.createTask).not.toHaveBeenCalled();
  });

  it('с clientId, нет активной связи (assertHasClient бросает) → ForbiddenException, createTask не вызывается', async () => {
    const { controller, relations, tasks } = makeController();
    relations.assertHasClient.mockRejectedValue(
      new Error('No active relation'),
    );
    await expect(
      controller.createTask(makeReq(7n), { type: 'x', text: 'y', clientId: 5 }),
    ).rejects.toThrow('No therapy relation with this client');
    expect(tasks.createTask).not.toHaveBeenCalled();
  });

  it('реальный клиент (clientId > 0) → createTask с targetUserId=BigInt(clientId), assignedBy=terapistId, шлётся нотификация', async () => {
    const { controller, tasks, relations } = makeController();
    const body = {
      type: 'reading',
      text: 'почитать главу',
      clientId: 5,
      needId: 'safety',
      dueDate: '2026-08-01',
    };
    const res = await controller.createTask(makeReq(7n), body);
    expect(relations.assertHasClient).toHaveBeenCalledWith(7n, 5);
    expect(tasks.createTask).toHaveBeenCalledWith(5n, body, 7n);
    expect(tasks.scheduleTaskNotification).toHaveBeenCalledWith(5n, {
      text: 'почитать главу',
      needId: 'safety',
      dueDate: '2026-08-01',
    });
    expect(res).toEqual({ id: 1, text: 'задача' });
  });

  it('виртуальный клиент (clientId < 0) → createTask вызван, но нотификация НЕ шлётся', async () => {
    const { controller, tasks } = makeController();
    await controller.createTask(makeReq(7n), {
      type: 'reading',
      text: 'y',
      clientId: -3,
    });
    expect(tasks.createTask).toHaveBeenCalledWith(-3n, expect.any(Object), 7n);
    expect(tasks.scheduleTaskNotification).not.toHaveBeenCalled();
  });
});

describe('TherapyTasksController.getTasks / getTaskHistory', () => {
  it('getTasks делегирует getTasks(userId)', async () => {
    const { controller, tasks } = makeController();
    const res = await controller.getTasks(makeReq(7n));
    expect(tasks.getTasks).toHaveBeenCalledWith(7n);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('getTaskHistory делегирует getTaskHistory(userId)', async () => {
    const { controller, tasks } = makeController();
    const res = await controller.getTaskHistory(makeReq(7n));
    expect(tasks.getTaskHistory).toHaveBeenCalledWith(7n);
    expect(res).toEqual([{ id: 2 }]);
  });
});

describe('TherapyTasksController.getAllTasks', () => {
  it('не терапевт → ForbiddenException', async () => {
    const { controller } = makeController({ account: makeAccount('CLIENT') });
    await expect(controller.getAllTasks(makeReq())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('терапевт → делегирует getAllTasksForTherapist(therapistId)', async () => {
    const { controller, tasksView } = makeController();
    const res = await controller.getAllTasks(makeReq(7n));
    expect(tasksView.getAllTasksForTherapist).toHaveBeenCalledWith(7n);
    expect(res).toEqual([{ clientId: 1 }]);
  });
});

describe('TherapyTasksController.getTasksForClient', () => {
  it('не терапевт → ForbiddenException', async () => {
    const { controller } = makeController({ account: makeAccount('CLIENT') });
    await expect(controller.getTasksForClient(makeReq(), '5')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('сервис вернул null (нет активной связи) → ForbiddenException', async () => {
    const { controller, tasksView } = makeController();
    tasksView.getTasksForClient.mockResolvedValue(null);
    await expect(
      controller.getTasksForClient(makeReq(7n), '5'),
    ).rejects.toThrow('No active relation with this client');
  });

  it('терапевт → делегирует getTasksForClient(therapistId, clientId)', async () => {
    const { controller, tasksView } = makeController();
    const res = await controller.getTasksForClient(makeReq(7n), '5');
    expect(tasksView.getTasksForClient).toHaveBeenCalledWith(7n, 5);
    expect(res).toEqual([{ id: 3 }]);
  });
});

describe('TherapyTasksController.completeTask', () => {
  it('задача не принадлежит юзеру (completeTask вернул false) → ForbiddenException', async () => {
    const { controller, tasks } = makeController();
    tasks.completeTask.mockResolvedValue(false);
    await expect(
      controller.completeTask(makeReq(7n), '9', { done: true }),
    ).rejects.toThrow('Task not found or not yours');
    expect(tasks.completeTask).toHaveBeenCalledWith(7n, 9, true);
  });

  it('задача принадлежит юзеру → { ok: true }', async () => {
    const { controller, tasks } = makeController();
    const res = await controller.completeTask(makeReq(7n), '9', {
      done: false,
    });
    expect(tasks.completeTask).toHaveBeenCalledWith(7n, 9, false);
    expect(res).toEqual({ ok: true });
  });
});
