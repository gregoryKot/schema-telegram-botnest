// Тест на схемы (YSQ): валидация ответов (ровно 116, 0..6 целых) — модель
// оценок фиксированная, битый массив ломает подсчёт баллов дальше по пайплайну.
// userId — всегда из req, никогда из тела (правило №5/чеклист новой таблицы).
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { YsqController } from './ysq.controller';
import type { YsqService } from '../bot/ysq.service';
import type { AnalyticsService } from '../analytics/analytics.service';

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
    deleteAllYsqData: jest.fn().mockResolvedValue({ attempts: 2 }),
    getYsqHistory: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as YsqService;
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const controller = new YsqController(
    ysqService,
    analytics as unknown as AnalyticsService,
  );
  return { controller, ysqService, analytics };
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

describe('YsqController.getYsqResult', () => {
  it('getYsqResult делегирует сервису под userId из req', async () => {
    const { controller, ysqService } = makeController({
      getYsqResult: jest.fn().mockResolvedValue({ answers: validAnswers() }),
    });
    const res = await controller.getYsqResult(makeReq(14n));
    expect(ysqService.getYsqResult).toHaveBeenCalledWith(14n);
    expect(res).toEqual({ answers: validAnswers() });
  });
});

// Хвост волны 4 (#1024): после U8 «Пройти заново» итог не стирает, сайт
// DELETE /api/ysq-result не зовёт — ручка удалена. Стирает итог только
// «Удалить результаты теста» (DELETE /api/ysq-data, всё разом).
describe('YsqController — какие DELETE-ручки есть', () => {
  it('ysq-progress и ysq-data; ysq-result — нет', () => {
    const proto = YsqController.prototype as unknown as Record<string, object>;
    const deletes = Object.getOwnPropertyNames(proto)
      .map((name) => proto[name])
      .filter(
        (fn) =>
          typeof fn === 'function' &&
          Reflect.getMetadata(METHOD_METADATA, fn) === RequestMethod.DELETE,
      )
      .map((fn) => Reflect.getMetadata(PATH_METADATA, fn) as string)
      .sort();
    expect(deletes).toEqual(['ysq-data', 'ysq-progress']);
  });
});

describe('YsqController.deleteAllYsqData (DELETE /api/ysq-data)', () => {
  it('стирает всё про тест под userId из подписи, чужой userId в теле не слушает', async () => {
    const { controller, ysqService } = makeController();
    const req = { ...makeReq(16n), body: { userId: 999 } };
    const res = await controller.deleteAllYsqData(req);
    expect(ysqService.deleteAllYsqData).toHaveBeenCalledWith(16n);
    expect(ysqService.deleteAllYsqData).toHaveBeenCalledTimes(1);
    // Всё стирает одна транзакция сервиса, отдельного удаления итога нет.
    expect(Object.keys(ysqService)).not.toContain('deleteYsqResult');
    expect(res).toEqual({ ok: true });
  });

  // Правило №8: без события воронка теста в /stats не отличала «не дошёл» от
  // «дошёл и стёр» (docs/open/backend.md, 2026-10-24).
  it('пишет ysq_data_deleted под userId из подписи с числом стёртых попыток', async () => {
    const { controller, analytics } = makeController();
    await controller.deleteAllYsqData(makeReq(16n));
    expect(analytics.track).toHaveBeenCalledWith(16n, 'ysq_data_deleted', {
      attempts: 2,
    });
  });

  it('число попыток в meta — с потолком', async () => {
    const { controller, analytics } = makeController({
      deleteAllYsqData: jest.fn().mockResolvedValue({ attempts: 5000 }),
    });
    await controller.deleteAllYsqData(makeReq(16n));
    expect(analytics.track).toHaveBeenCalledWith(16n, 'ysq_data_deleted', {
      attempts: 1000,
    });
  });

  it('удаление упало — события нет', async () => {
    const { controller, analytics } = makeController({
      deleteAllYsqData: jest.fn().mockRejectedValue(new Error('db down')),
    });
    await expect(controller.deleteAllYsqData(makeReq(16n))).rejects.toThrow(
      'db down',
    );
    expect(analytics.track).not.toHaveBeenCalled();
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
