// Быстрые практики «Здесь и сейчас»: фиксация прохождения. Класс бага,
// который ловим — userId для записи и для чтения счётчиков обязан быть
// req.webUser.userId, а не что-то из тела запроса (тело содержит только
// `tool`, но регрессия могла бы прокрасться, если бы кто-то потом добавил
// userId в DTO «для отладки»).
import { PracticeSessionsController } from './practice-sessions.controller';
import type { PracticeSessionsService } from '../bot/practice-sessions.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

describe('PracticeSessionsController.record', () => {
  it('пишет сессию под userId из req, а не из тела; возвращает count из сервиса', async () => {
    const record = jest.fn().mockResolvedValue({ count: 5 });
    const controller = new PracticeSessionsController({
      record,
    } as unknown as PracticeSessionsService);

    const res = await controller.record(makeReq(42n), {
      tool: 'breathing',
    } as any);

    expect(record).toHaveBeenCalledWith(42n, 'breathing');
    expect(res).toEqual({ ok: true, count: 5 });
  });
});

describe('PracticeSessionsController.getCounts', () => {
  it('отдаёт счётчики именно текущего пользователя', async () => {
    const counts = { breathing: 2, grounding: 0, stop: 1 };
    const getCounts = jest.fn().mockResolvedValue(counts);
    const controller = new PracticeSessionsController({
      counts: getCounts,
    } as unknown as PracticeSessionsService);

    await expect(controller.getCounts(makeReq(9n))).resolves.toEqual(counts);
    expect(getCounts).toHaveBeenCalledWith(9n);
  });
});
