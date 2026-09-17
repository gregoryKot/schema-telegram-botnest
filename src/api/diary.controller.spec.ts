// Дневники схем/режимов/благодарности: обязательные поля, обрезка свободного
// текста до 2000 символов (правило CLAUDE.md о свободном тексте — здесь нет
// crisisMarkers, дневник не про чувства кризиса напрямую, но лимиты и userId
// всё равно security-критичны), фоновый checkStreakTasks не должен ронять ответ.
import { BadRequestException } from '@nestjs/common';
import { DiaryController } from './diary.controller';
import type { DiaryService } from '../bot/diary.service';
import type { TherapyTasksService } from '../therapy/therapy-tasks.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function makeController(overrides: Partial<DiaryService> = {}) {
  const diaryService = {
    getSchemaDiaryEntries: jest.fn().mockResolvedValue([]),
    createSchemaDiaryEntry: jest.fn().mockResolvedValue({ id: 1 }),
    deleteSchemaDiaryEntry: jest.fn().mockResolvedValue(undefined),
    getModeDiaryEntries: jest.fn().mockResolvedValue([]),
    createModeDiaryEntry: jest.fn().mockResolvedValue({ id: 2 }),
    deleteModeDiaryEntry: jest.fn().mockResolvedValue(undefined),
    getGratitudeDiaryEntries: jest.fn().mockResolvedValue([]),
    upsertGratitudeDiaryEntry: jest.fn().mockResolvedValue({ id: 3 }),
    deleteGratitudeDiaryEntry: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as DiaryService;
  const tasksService = {
    checkStreakTasks: jest.fn().mockResolvedValue(undefined),
  } as unknown as TherapyTasksService;
  return {
    controller: new DiaryController(diaryService, tasksService),
    diaryService,
    tasksService,
  };
}

describe('DiaryController schema diary', () => {
  it('пустой trigger → BadRequestException, запись не создаётся', async () => {
    const { controller, diaryService } = makeController();
    await expect(
      controller.createSchemaDiary(makeReq(), {
        trigger: '   ',
        emotions: [],
        schemaIds: [],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(diaryService.createSchemaDiaryEntry).not.toHaveBeenCalled();
  });

  it('обрезает свободный текст до 2000 символов перед сохранением', async () => {
    const { controller, diaryService } = makeController();
    await controller.createSchemaDiary(makeReq(6n), {
      trigger: 'x'.repeat(3000),
      thoughts: 'y'.repeat(2500),
      emotions: [],
      schemaIds: ['abandonment'],
    });
    const [userId, saved] = (diaryService.createSchemaDiaryEntry as jest.Mock)
      .mock.calls[0];
    expect(userId).toBe(6n);
    expect(saved.trigger.length).toBe(2000);
    expect(saved.thoughts.length).toBe(2000);
  });

  it('успешное создание в фоне запускает checkStreakTasks, падение фона не мешает ответу', async () => {
    const { controller, tasksService } = makeController();
    (tasksService.checkStreakTasks as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );
    const res = await controller.createSchemaDiary(makeReq(), {
      trigger: 'триггер',
      emotions: [],
      schemaIds: [],
    });
    expect(res).toEqual({ id: 1 });
    expect(tasksService.checkStreakTasks).toHaveBeenCalled();
  });

  it('delete — parseId валидирует id, userId берётся из req', async () => {
    const { controller, diaryService } = makeController();
    await controller.deleteSchemaDiary(makeReq(8n), '15');
    expect(diaryService.deleteSchemaDiaryEntry).toHaveBeenCalledWith(8n, 15);
    await expect(
      controller.deleteSchemaDiary(makeReq(8n), 'not-a-number'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('DiaryController mode diary', () => {
  it('пустой modeId или situation → BadRequestException', async () => {
    const { controller, diaryService } = makeController();
    await expect(
      controller.createModeDiary(makeReq(), {
        modeId: '',
        situation: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.createModeDiary(makeReq(), {
        modeId: 'critic',
        situation: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(diaryService.createModeDiaryEntry).not.toHaveBeenCalled();
  });

  it('валидная запись сохраняется под userId из req, чужой userId в body игнорируется', async () => {
    const { controller, diaryService } = makeController();
    await controller.createModeDiary(makeReq(3n), {
      modeId: 'critic',
      situation: 'ситуация',
      userId: 999,
    } as any);
    expect(diaryService.createModeDiaryEntry).toHaveBeenCalledWith(
      3n,
      expect.objectContaining({ modeId: 'critic', situation: 'ситуация' }),
    );
  });

  it('падение фонового checkStreakTasks не мешает ответу', async () => {
    const { controller, tasksService } = makeController();
    (tasksService.checkStreakTasks as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );
    const res = await controller.createModeDiary(makeReq(), {
      modeId: 'critic',
      situation: 'ситуация',
    });
    expect(res).toEqual({ id: 2 });
    expect(tasksService.checkStreakTasks).toHaveBeenCalled();
  });

  it('delete — parseId валидирует id, userId берётся из req', async () => {
    const { controller, diaryService } = makeController();
    await controller.deleteModeDiary(makeReq(9n), '22');
    expect(diaryService.deleteModeDiaryEntry).toHaveBeenCalledWith(9n, 22);
    await expect(
      controller.deleteModeDiary(makeReq(9n), 'not-a-number'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('DiaryController gratitude diary', () => {
  it('невалидный формат даты → BadRequestException', async () => {
    const { controller, diaryService } = makeController();
    await expect(
      controller.createGratitudeDiary(makeReq(), {
        date: '01.07.2026',
        items: ['a'],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(diaryService.upsertGratitudeDiaryEntry).not.toHaveBeenCalled();
  });

  it('обрезает каждый item до 500 символов', async () => {
    const { controller, diaryService } = makeController();
    await controller.createGratitudeDiary(makeReq(2n), {
      date: '2026-07-17',
      items: ['a'.repeat(600), 'короткий'],
    });
    expect(diaryService.upsertGratitudeDiaryEntry).toHaveBeenCalledWith(
      2n,
      '2026-07-17',
      ['a'.repeat(500), 'короткий'],
    );
  });

  it('delete — userId из req, не из параметра', async () => {
    const { controller, diaryService } = makeController();
    await controller.deleteGratitudeDiary(makeReq(5n), '3');
    expect(diaryService.deleteGratitudeDiaryEntry).toHaveBeenCalledWith(5n, 3);
  });

  it('падение фонового checkStreakTasks не мешает ответу', async () => {
    const { controller, tasksService } = makeController();
    (tasksService.checkStreakTasks as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );
    const res = await controller.createGratitudeDiary(makeReq(), {
      date: '2026-07-17',
      items: ['короткий'],
    });
    expect(res).toEqual({ id: 3 });
    expect(tasksService.checkStreakTasks).toHaveBeenCalled();
  });
});

describe('DiaryController GET-эндпоинты делегируют с userId из req', () => {
  it('schema/mode/gratitude чтение', async () => {
    const { controller, diaryService } = makeController();
    await controller.getSchemaDiary(makeReq(1n));
    await controller.getModeDiary(makeReq(2n));
    await controller.getGratitudeDiary(makeReq(3n));
    expect(diaryService.getSchemaDiaryEntries).toHaveBeenCalledWith(1n);
    expect(diaryService.getModeDiaryEntries).toHaveBeenCalledWith(2n);
    expect(diaryService.getGratitudeDiaryEntries).toHaveBeenCalledWith(3n);
  });
});
