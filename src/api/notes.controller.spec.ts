// Карточки схем/режимов: userId только из req (см. CLAUDE.md правило про
// денормализацию mySchemaIds/UserSchemaNote), а schemaId/modeId обязаны
// пройти формат [a-z_]{1,64} — иначе можно протащить произвольный ключ
// (SQL-инъекция маловероятна через Prisma, но ломает денормализованный
// реестр и чужой JSON).
import { BadRequestException } from '@nestjs/common';
import { NotesController } from './notes.controller';
import type { NotesService } from '../bot/notes.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function makeController(overrides: Partial<NotesService> = {}) {
  const notesService = {
    getSchemaNotes: jest.fn().mockResolvedValue([]),
    upsertSchemaNote: jest.fn().mockResolvedValue({ id: 1 }),
    getModeNotes: jest.fn().mockResolvedValue([]),
    upsertModeNote: jest.fn().mockResolvedValue({ id: 2 }),
    ...overrides,
  } as unknown as NotesService;
  return { controller: new NotesController(notesService), notesService };
}

describe('NotesController.getSchemaNotes / getModeNotes', () => {
  it('делегирует чтение с userId из req', async () => {
    const { controller, notesService } = makeController();
    await controller.getSchemaNotes(makeReq(5n));
    expect(notesService.getSchemaNotes).toHaveBeenCalledWith(5n);
    await controller.getModeNotes(makeReq(5n));
    expect(notesService.getModeNotes).toHaveBeenCalledWith(5n);
  });
});

describe('NotesController.upsertSchemaNote', () => {
  it('невалидный schemaId (не [a-z_]{1,64}) → BadRequestException, сервис не вызван', async () => {
    const { controller, notesService } = makeController();
    await expect(
      controller.upsertSchemaNote(makeReq(), {
        schemaId: 'abandonment-1', // дефис — вне [a-z_]
        triggers: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(notesService.upsertSchemaNote).not.toHaveBeenCalled();
  });

  it('валидный schemaId → сохраняет под userId из req, поля тримятся сервисом-обёрткой', async () => {
    const { controller, notesService } = makeController();
    await controller.upsertSchemaNote(makeReq(3n), {
      schemaId: 'abandonment',
      triggers: '  громко  ',
      reality: '  правда  ',
    });
    expect(notesService.upsertSchemaNote).toHaveBeenCalledWith(
      3n,
      'abandonment',
      expect.objectContaining({ triggers: 'громко', reality: 'правда' }),
    );
  });

  it('чужой userId в теле игнорируется — сохраняется под userId из req', async () => {
    const { controller, notesService } = makeController();
    await controller.upsertSchemaNote(makeReq(3n), {
      schemaId: 'abandonment',
      userId: 999, // атака: подсунуть чужой id в body
    } as any);
    expect(notesService.upsertSchemaNote).toHaveBeenCalledWith(
      3n,
      'abandonment',
      expect.anything(),
    );
  });
});

describe('NotesController.upsertModeNote', () => {
  it('невалидный modeId → BadRequestException', async () => {
    const { controller, notesService } = makeController();
    await expect(
      controller.upsertModeNote(makeReq(), {
        modeId: 'Punitive Parent', // пробел/заглавные — вне формата
      }),
    ).rejects.toThrow(BadRequestException);
    expect(notesService.upsertModeNote).not.toHaveBeenCalled();
  });

  it('валидный modeId — needs тримится и передаётся отдельным полем', async () => {
    const { controller, notesService } = makeController();
    await controller.upsertModeNote(makeReq(7n), {
      modeId: 'punitive_parent',
      needs: '  безопасность  ',
    });
    expect(notesService.upsertModeNote).toHaveBeenCalledWith(
      7n,
      'punitive_parent',
      expect.objectContaining({ needs: 'безопасность' }),
    );
  });

  it('modeFunction/needsMet тримятся и передаются отдельными полями', async () => {
    const { controller, notesService } = makeController();
    await controller.upsertModeNote(makeReq(7n), {
      modeId: 'punitive_parent',
      modeFunction: '  защищает от боли  ',
      needsMet: '  на время — да, по сути — нет  ',
    });
    expect(notesService.upsertModeNote).toHaveBeenCalledWith(
      7n,
      'punitive_parent',
      expect.objectContaining({
        modeFunction: 'защищает от боли',
        needsMet: 'на время — да, по сути — нет',
      }),
    );
  });
});
