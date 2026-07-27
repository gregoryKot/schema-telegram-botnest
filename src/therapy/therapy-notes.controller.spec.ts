// TherapyNotesController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками — паттерн auth-2fa.controller.spec.ts
// (Pick<Service, 'method'> & { method: jest.Mock }). Каждый хендлер: роль !=
// THERAPIST → 403 до вызова сервиса; сервис бросает 'No active relation' →
// 403; невалидное тело (дата/текст заметки) → 400 до вызова сервиса.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { TherapyNotesController } from './therapy-notes.controller';
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyClientDataService } from './therapy-client-data.service';
import { AccountService } from '../bot/account.service';

type NotesMock = Pick<
  TherapyNotesService,
  | 'getNotes'
  | 'createNote'
  | 'deleteNote'
  | 'getConceptualization'
  | 'saveConceptualization'
> & {
  getNotes: jest.Mock;
  createNote: jest.Mock;
  deleteNote: jest.Mock;
  getConceptualization: jest.Mock;
  saveConceptualization: jest.Mock;
};

type ClientDataMock = Pick<TherapyClientDataService, 'updateSessionInfo'> & {
  updateSessionInfo: jest.Mock;
};

type AccountMock = Pick<AccountService, 'getUserRole'> & {
  getUserRole: jest.Mock;
};

function makeNotes(): NotesMock {
  return {
    getNotes: jest.fn().mockResolvedValue([{ id: 1, text: 'заметка' }]),
    createNote: jest
      .fn()
      .mockResolvedValue({ id: 2, date: '2026-07-01', text: 'новая' }),
    deleteNote: jest.fn().mockResolvedValue(undefined),
    getConceptualization: jest.fn().mockResolvedValue({ schemaIds: [] }),
    saveConceptualization: jest.fn().mockResolvedValue({ ok: true }),
  };
}

function makeClientData(): ClientDataMock {
  return { updateSessionInfo: jest.fn().mockResolvedValue(undefined) };
}

function makeAccount(role: 'CLIENT' | 'THERAPIST' = 'THERAPIST'): AccountMock {
  return { getUserRole: jest.fn().mockResolvedValue(role) };
}

function makeReq(userId = 42n): Request {
  return { webUser: { userId } } as unknown as Request;
}

function makeController(opts: { account?: AccountMock } = {}) {
  const notes = makeNotes();
  const clientData = makeClientData();
  const account = opts.account ?? makeAccount();
  const controller = new TherapyNotesController(
    notes as unknown as TherapyNotesService,
    clientData as unknown as TherapyClientDataService,
    account as unknown as AccountService,
  );
  return { controller, notes, clientData, account };
}

describe('TherapyNotesController.getNotes', () => {
  it('не терапевт → ForbiddenException, сервис не вызывается', async () => {
    const { controller, notes } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(controller.getNotes(makeReq(), '5')).rejects.toThrow(
      ForbiddenException,
    );
    expect(notes.getNotes).not.toHaveBeenCalled();
  });

  it('терапевт → делегирует getNotes(therapistId, clientId)', async () => {
    const { controller, notes } = makeController();
    const res = await controller.getNotes(makeReq(3n), '5');
    expect(notes.getNotes).toHaveBeenCalledWith(3n, 5);
    expect(res).toEqual([{ id: 1, text: 'заметка' }]);
  });

  it('No active relation → ForbiddenException', async () => {
    const { controller, notes } = makeController();
    notes.getNotes.mockRejectedValue(new Error('No active relation'));
    await expect(controller.getNotes(makeReq(3n), '5')).rejects.toThrow(
      'No active relation with this client',
    );
  });
});

describe('TherapyNotesController.createNote', () => {
  const VALID_BODY = { date: '2026-07-01', text: 'текст заметки' };

  it('не терапевт → ForbiddenException, createNote не вызывается', async () => {
    const { controller, notes } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(
      controller.createNote(makeReq(), '5', VALID_BODY),
    ).rejects.toThrow(ForbiddenException);
    expect(notes.createNote).not.toHaveBeenCalled();
  });

  it('пустой text → BadRequestException, сервис не вызывается', async () => {
    const { controller, notes } = makeController();
    await expect(
      controller.createNote(makeReq(3n), '5', {
        date: '2026-07-01',
        text: '  ',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(notes.createNote).not.toHaveBeenCalled();
  });

  it('невалидная дата → BadRequestException("Invalid date")', async () => {
    const { controller, notes } = makeController();
    await expect(
      controller.createNote(makeReq(3n), '5', {
        date: '01-07-2026',
        text: 'x',
      }),
    ).rejects.toThrow('Invalid date');
    expect(notes.createNote).not.toHaveBeenCalled();
  });

  it('валидное тело → делегирует createNote(therapistId, clientId, {date, text})', async () => {
    const { controller, notes } = makeController();
    const res = await controller.createNote(makeReq(3n), '5', VALID_BODY);
    expect(notes.createNote).toHaveBeenCalledWith(3n, 5, {
      date: '2026-07-01',
      text: 'текст заметки',
    });
    expect(res).toEqual({ id: 2, date: '2026-07-01', text: 'новая' });
  });

  it('текст длиннее 5000 символов обрезается до 5000 перед передачей в сервис', async () => {
    const { controller, notes } = makeController();
    const longText = 'а'.repeat(6000);
    await controller.createNote(makeReq(3n), '5', {
      date: '2026-07-01',
      text: longText,
    });
    const passed = notes.createNote.mock.calls[0][2] as { text: string };
    expect(passed.text).toHaveLength(5000);
  });
});

describe('TherapyNotesController.deleteNote', () => {
  it('не терапевт → ForbiddenException', async () => {
    const { controller, notes } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(controller.deleteNote(makeReq(), '9')).rejects.toThrow(
      ForbiddenException,
    );
    expect(notes.deleteNote).not.toHaveBeenCalled();
  });

  it('терапевт → делегирует deleteNote(therapistId, noteId) и возвращает { ok: true }', async () => {
    const { controller, notes } = makeController();
    const res = await controller.deleteNote(makeReq(3n), '9');
    expect(notes.deleteNote).toHaveBeenCalledWith(3n, 9);
    expect(res).toEqual({ ok: true });
  });
});

describe('TherapyNotesController.getConceptualization', () => {
  it('терапевт → делегирует getConceptualization(therapistId, clientId)', async () => {
    const { controller, notes } = makeController();
    const res = await controller.getConceptualization(makeReq(3n), '5');
    expect(notes.getConceptualization).toHaveBeenCalledWith(3n, 5);
    expect(res).toEqual({ schemaIds: [] });
  });

  it('No active relation → ForbiddenException', async () => {
    const { controller, notes } = makeController();
    notes.getConceptualization.mockRejectedValue(
      new Error('No active relation'),
    );
    await expect(
      controller.getConceptualization(makeReq(3n), '5'),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('TherapyNotesController.updateSessionInfo', () => {
  it('не терапевт → ForbiddenException, updateSessionInfo не вызывается', async () => {
    const { controller, clientData } = makeController({
      account: makeAccount('CLIENT'),
    });
    await expect(
      controller.updateSessionInfo(makeReq(), '5', {}),
    ).rejects.toThrow(ForbiddenException);
    expect(clientData.updateSessionInfo).not.toHaveBeenCalled();
  });

  it('терапевт → делегирует updateSessionInfo(therapistId, clientId, body) и возвращает { ok: true }', async () => {
    const { controller, clientData } = makeController();
    const body = { therapyStartDate: '2026-01-01', meetingDays: [1, 3] };
    const res = await controller.updateSessionInfo(makeReq(3n), '5', body);
    expect(clientData.updateSessionInfo).toHaveBeenCalledWith(3n, 5, body);
    expect(res).toEqual({ ok: true });
  });
});

describe('TherapyNotesController.saveConceptualization', () => {
  it('терапевт → делегирует saveConceptualization(therapistId, clientId, body)', async () => {
    const { controller, notes } = makeController();
    const body = { schemaIds: ['abandonment'] };
    const res = await controller.saveConceptualization(makeReq(3n), '5', body);
    expect(notes.saveConceptualization).toHaveBeenCalledWith(3n, 5, body);
    expect(res).toEqual({ ok: true });
  });

  it('No active relation → ForbiddenException', async () => {
    const { controller, notes } = makeController();
    notes.saveConceptualization.mockRejectedValue(
      new Error('No active relation'),
    );
    await expect(
      controller.saveConceptualization(makeReq(3n), '5', {}),
    ).rejects.toThrow(ForbiddenException);
  });
});
