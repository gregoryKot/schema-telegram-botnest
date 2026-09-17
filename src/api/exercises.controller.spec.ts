// Инструменты дневника (belief-checks/letters/safe-place/flashcards) —
// самостоятельные user-owned упражнения. Проверяем: пустой пул фраз ЗВ не
// падает 500, обязательные поля, trim/filter пустых evidence, userId из
// req на write-путях (не из body).
import { BadRequestException } from '@nestjs/common';
import { ExercisesController } from './exercises.controller';
import type { ExercisesService } from '../bot/exercises.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function makeController(
  svcOverrides: Partial<ExercisesService> = {},
  healthyOverrides: Partial<HealthyAdultService> = {},
) {
  const exercisesService = {
    getBeliefChecks: jest.fn().mockResolvedValue([]),
    createBeliefCheck: jest.fn().mockResolvedValue({ id: 1 }),
    deleteBeliefCheck: jest.fn().mockResolvedValue(undefined),
    getLetters: jest.fn().mockResolvedValue([]),
    createLetter: jest.fn().mockResolvedValue({ id: 2 }),
    deleteLetter: jest.fn().mockResolvedValue(undefined),
    getSafePlace: jest.fn().mockResolvedValue(null),
    upsertSafePlace: jest.fn().mockResolvedValue({ id: 3 }),
    getFlashcards: jest.fn().mockResolvedValue([]),
    createFlashcard: jest.fn().mockResolvedValue({ id: 4 }),
    deleteFlashcard: jest.fn().mockResolvedValue(undefined),
    ...svcOverrides,
  } as unknown as ExercisesService;
  const healthyAdult = {
    enabledTexts: jest.fn().mockResolvedValue([]),
    ...healthyOverrides,
  } as unknown as HealthyAdultService;
  return {
    controller: new ExercisesController(exercisesService, healthyAdult),
    exercisesService,
    healthyAdult,
  };
}

describe('ExercisesController.getHealthyPhrase', () => {
  it('пустой пул → { text: null }, не падает', async () => {
    const { controller } = makeController();
    await expect(controller.getHealthyPhrase()).resolves.toEqual({
      text: null,
    });
  });

  it('непустой пул → одна из фраз (не выдуманная константа)', async () => {
    const { controller } = makeController(
      {},
      { enabledTexts: jest.fn().mockResolvedValue(['A', 'B', 'C']) },
    );
    const { text } = await controller.getHealthyPhrase();
    expect(['A', 'B', 'C']).toContain(text);
  });
});

describe('ExercisesController — GET/DELETE делегируют с userId из req', () => {
  it('getBeliefChecks/getLetters/getSafePlace/getFlashcards читают под своим userId', async () => {
    const { controller, exercisesService } = makeController();
    await controller.getBeliefChecks(makeReq(11n));
    await controller.getLetters(makeReq(12n));
    await controller.getSafePlace(makeReq(13n));
    await controller.getFlashcards(makeReq(14n));
    expect(exercisesService.getBeliefChecks).toHaveBeenCalledWith(11n);
    expect(exercisesService.getLetters).toHaveBeenCalledWith(12n);
    expect(exercisesService.getSafePlace).toHaveBeenCalledWith(13n);
    expect(exercisesService.getFlashcards).toHaveBeenCalledWith(14n);
  });

  it('deleteLetter/deleteFlashcard удаляют под userId из req, чужой id не подставляется', async () => {
    const { controller, exercisesService } = makeController();
    await controller.deleteLetter(makeReq(7n), '20');
    await controller.deleteFlashcard(makeReq(7n), '21');
    expect(exercisesService.deleteLetter).toHaveBeenCalledWith(7n, 20);
    expect(exercisesService.deleteFlashcard).toHaveBeenCalledWith(7n, 21);
  });
});

describe('ExercisesController belief-checks', () => {
  it('фильтрует пустые/пробельные строки из evidence, тримит belief/reframe', async () => {
    const { controller, exercisesService } = makeController();
    await controller.createBeliefCheck(makeReq(9n), {
      belief: '  Я всем должен  ',
      evidenceFor: ['факт 1', '   ', ''],
      evidenceAgainst: ['контрфакт', ''],
      reframe: '  переформулировка  ',
    });
    expect(exercisesService.createBeliefCheck).toHaveBeenCalledWith(9n, {
      belief: 'Я всем должен',
      evidenceFor: ['факт 1'],
      evidenceAgainst: ['контрфакт'],
      reframe: 'переформулировка',
    });
  });

  it('пустой reframe становится undefined, а не пустой строкой', async () => {
    const { controller, exercisesService } = makeController();
    await controller.createBeliefCheck(makeReq(), {
      belief: 'b',
      evidenceFor: [],
      evidenceAgainst: [],
      reframe: '   ',
    });
    expect(exercisesService.createBeliefCheck).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ reframe: undefined }),
    );
  });

  it('delete — id парсится строго, userId из req', async () => {
    const { controller, exercisesService } = makeController();
    await controller.deleteBeliefCheck(makeReq(4n), '10');
    expect(exercisesService.deleteBeliefCheck).toHaveBeenCalledWith(4n, 10);
    expect(() => controller.deleteBeliefCheck(makeReq(4n), 'x')).toThrow(
      BadRequestException,
    );
  });
});

describe('ExercisesController letters', () => {
  it('пустой text → BadRequestException', async () => {
    const { controller, exercisesService } = makeController();
    await expect(
      controller.createLetter(makeReq(), { text: '' }),
    ).rejects.toThrow(BadRequestException);
    expect(exercisesService.createLetter).not.toHaveBeenCalled();
  });

  it('текст тримится, сохраняется под userId из req', async () => {
    const { controller, exercisesService } = makeController();
    await controller.createLetter(makeReq(2n), {
      text: '  дорогой я  ',
    });
    expect(exercisesService.createLetter).toHaveBeenCalledWith(2n, 'дорогой я');
  });
});

describe('ExercisesController safe-place', () => {
  it('пустое description → BadRequestException', async () => {
    const { controller, exercisesService } = makeController();
    await expect(
      controller.upsertSafePlace(makeReq(), {
        description: undefined,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(exercisesService.upsertSafePlace).not.toHaveBeenCalled();
  });

  it('сохраняет описание под userId из req', async () => {
    const { controller, exercisesService } = makeController();
    await controller.upsertSafePlace(makeReq(3n), {
      description: '  лес  ',
    });
    expect(exercisesService.upsertSafePlace).toHaveBeenCalledWith(3n, 'лес');
  });
});

describe('ExercisesController flashcards', () => {
  it('невалидный modeId (не [a-z_]{1,64}) → BadRequestException', async () => {
    const { controller, exercisesService } = makeController();
    await expect(
      controller.createFlashcard(makeReq(), {
        modeId: 'Bad Mode!',
        needId: 'attachment',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(exercisesService.createFlashcard).not.toHaveBeenCalled();
  });

  it('отсутствующий needId → BadRequestException', async () => {
    const { controller, exercisesService } = makeController();
    await expect(
      controller.createFlashcard(makeReq(), {
        modeId: 'critic',
        needId: undefined,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(exercisesService.createFlashcard).not.toHaveBeenCalled();
  });

  it('валидная карточка сохраняется под userId из req', async () => {
    const { controller, exercisesService } = makeController();
    await controller.createFlashcard(makeReq(6n), {
      modeId: 'critic',
      needId: 'attachment',
      reflection: '  мысль  ',
    });
    expect(exercisesService.createFlashcard).toHaveBeenCalledWith(6n, {
      modeId: 'critic',
      needId: 'attachment',
      reflection: 'мысль',
      action: undefined,
    });
  });

  it('без reflection и с action — action тримится, reflection остаётся undefined', async () => {
    const { controller, exercisesService } = makeController();
    await controller.createFlashcard(makeReq(6n), {
      modeId: 'critic',
      needId: 'attachment',
      action: '  сделать паузу  ',
    });
    expect(exercisesService.createFlashcard).toHaveBeenCalledWith(6n, {
      modeId: 'critic',
      needId: 'attachment',
      reflection: undefined,
      action: 'сделать паузу',
    });
  });
});
