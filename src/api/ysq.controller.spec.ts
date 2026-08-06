// Тест на схемы (YSQ): валидация ответов (ровно 116, 0..6 целых) — модель
// оценок фиксированная, битый массив ломает подсчёт баллов дальше по пайплайну.
// userId — всегда из req, никогда из тела (правило №5/чеклист новой таблицы).
import { BadRequestException } from '@nestjs/common';
import { YsqController } from './ysq.controller';
import type { YsqService } from '../bot/ysq.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function validAnswers() {
  return Array.from({ length: 116 }, (_, i) => i % 7);
}

function makeController(overrides: Partial<YsqService> = {}) {
  const ysqService = {
    getYsqProgress: jest.fn().mockResolvedValue(null),
    saveYsqProgress: jest.fn().mockResolvedValue(undefined),
    deleteYsqProgress: jest.fn().mockResolvedValue(undefined),
    getYsqResult: jest.fn().mockResolvedValue(null),
    saveYsqResult: jest.fn().mockResolvedValue(undefined),
    deleteYsqResult: jest.fn().mockResolvedValue(undefined),
    getYsqHistory: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as YsqService;
  return { controller: new YsqController(ysqService), ysqService };
}

describe('YsqController.saveYsqProgress', () => {
  it('неверная длина массива ответов → BadRequestException', async () => {
    const { controller, ysqService } = makeController();
    await expect(
      controller.saveYsqProgress(makeReq(), {
        answers: [1, 2, 3],
        page: 0,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ysqService.saveYsqProgress).not.toHaveBeenCalled();
  });

  it('значение вне диапазона 0..6 → BadRequestException', async () => {
    const { controller, ysqService } = makeController();
    const answers = validAnswers();
    answers[10] = 7;
    await expect(
      controller.saveYsqProgress(makeReq(), { answers, page: 0 }),
    ).rejects.toThrow(BadRequestException);
    expect(ysqService.saveYsqProgress).not.toHaveBeenCalled();
  });

  it('дробное значение отклоняется', async () => {
    const { controller, ysqService } = makeController();
    const answers = validAnswers();
    answers[0] = 2.5;
    await expect(
      controller.saveYsqProgress(makeReq(), { answers, page: 0 }),
    ).rejects.toThrow(BadRequestException);
    expect(ysqService.saveYsqProgress).not.toHaveBeenCalled();
  });

  it('отрицательный page → BadRequestException', async () => {
    const { controller, ysqService } = makeController();
    await expect(
      controller.saveYsqProgress(makeReq(), {
        answers: validAnswers(),
        page: -1,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ysqService.saveYsqProgress).not.toHaveBeenCalled();
  });

  it('валидные данные сохраняются под userId из req', async () => {
    const { controller, ysqService } = makeController();
    const answers = validAnswers();
    await controller.saveYsqProgress(makeReq(11n), {
      answers,
      page: 2,
    });
    expect(ysqService.saveYsqProgress).toHaveBeenCalledWith(11n, answers, 2);
  });
});

describe('YsqController.saveYsqResult', () => {
  it('неверная длина/диапазон → BadRequestException, сервис не вызван', async () => {
    const { controller, ysqService } = makeController();
    await expect(
      controller.saveYsqResult(makeReq(), { answers: [] }),
    ).rejects.toThrow(BadRequestException);
    expect(ysqService.saveYsqResult).not.toHaveBeenCalled();
  });

  it('значение вне диапазона 0..6 при верной длине → BadRequestException', async () => {
    const { controller, ysqService } = makeController();
    const answers = validAnswers();
    answers[3] = 9;
    await expect(
      controller.saveYsqResult(makeReq(), { answers }),
    ).rejects.toThrow(BadRequestException);
    expect(ysqService.saveYsqResult).not.toHaveBeenCalled();
  });

  it('валидные ответы сохраняются под userId из req, чужой userId в body игнорируется', async () => {
    const { controller, ysqService } = makeController();
    const answers = validAnswers();
    await controller.saveYsqResult(makeReq(4n), {
      answers,
      userId: 999,
    } as any);
    expect(ysqService.saveYsqResult).toHaveBeenCalledWith(4n, answers);
  });
});

describe('YsqController.getYsqProgress/deleteYsqProgress', () => {
  it('getYsqProgress делегирует сервису под userId из req', async () => {
    const { controller, ysqService } = makeController({
      getYsqProgress: jest
        .fn()
        .mockResolvedValue({ answers: validAnswers(), page: 4 }),
    });
    const res = await controller.getYsqProgress(makeReq(12n));
    expect(ysqService.getYsqProgress).toHaveBeenCalledWith(12n);
    expect(res).toEqual({ answers: validAnswers(), page: 4 });
  });

  it('deleteYsqProgress удаляет под userId из req и возвращает { ok: true }', async () => {
    const { controller, ysqService } = makeController();
    const res = await controller.deleteYsqProgress(makeReq(13n));
    expect(ysqService.deleteYsqProgress).toHaveBeenCalledWith(13n);
    expect(res).toEqual({ ok: true });
  });
});

describe('YsqController.getYsqResult/deleteYsqResult', () => {
  it('getYsqResult делегирует сервису под userId из req', async () => {
    const { controller, ysqService } = makeController({
      getYsqResult: jest.fn().mockResolvedValue({ answers: validAnswers() }),
    });
    const res = await controller.getYsqResult(makeReq(14n));
    expect(ysqService.getYsqResult).toHaveBeenCalledWith(14n);
    expect(res).toEqual({ answers: validAnswers() });
  });

  it('deleteYsqResult удаляет под userId из req и возвращает { ok: true }', async () => {
    const { controller, ysqService } = makeController();
    const res = await controller.deleteYsqResult(makeReq(15n));
    expect(ysqService.deleteYsqResult).toHaveBeenCalledWith(15n);
    expect(res).toEqual({ ok: true });
  });
});

describe('YsqController.getYsqHistory', () => {
  it('считает баллы по сохранённым ответам и сериализует дату', async () => {
    const completedAt = new Date('2026-07-01T00:00:00.000Z');
    const { controller } = makeController({
      getYsqHistory: jest
        .fn()
        .mockResolvedValue([{ id: 1, completedAt, answers: validAnswers() }]),
    });
    const res = await controller.getYsqHistory(makeReq());
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(1);
    expect(res[0].completedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(res[0].scores).toBeDefined();
    expect(typeof res[0].scores).toBe('object');
  });

  it('пустая история → пустой массив, не падает', async () => {
    const { controller } = makeController({
      getYsqHistory: jest.fn().mockResolvedValue([]),
    });
    await expect(controller.getYsqHistory(makeReq())).resolves.toEqual([]);
  });
});
