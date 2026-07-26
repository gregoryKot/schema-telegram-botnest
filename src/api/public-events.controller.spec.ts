// Анонимный приём событий мини-тестов: пишем только известные события с
// валидной meta по реестру тестов, src клиента игнорируем, userId = null.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicEventsController } from './public-events.controller';
import { PublicEventDto } from './dto/public-event.dto';
import type { AnalyticsService } from '../analytics/analytics.service';

describe('PublicEventDto', () => {
  const errorsFor = async (body: Record<string, unknown>) => {
    const errs = await validate(plainToInstance(PublicEventDto, body), {
      whitelist: true,
    });
    return errs.map((e) => e.property);
  };

  it('quiz_started / quiz_completed проходят', async () => {
    await expect(
      errorsFor({ name: 'quiz_started', meta: { quiz: 'drives' } }),
    ).resolves.toEqual([]);
    await expect(errorsFor({ name: 'quiz_completed' })).resolves.toEqual([]);
  });

  it("НЕ-публичные события allow-list'а отклоняются (только срез тестов)", async () => {
    await expect(errorsFor({ name: 'share_card' })).resolves.toContain('name');
    await expect(errorsFor({ name: 'journey_open' })).resolves.toContain(
      'name',
    );
  });

  it('мусорное имя и meta-не-объект отклоняются', async () => {
    await expect(errorsFor({ name: 'hack' })).resolves.toContain('name');
    await expect(
      errorsFor({ name: 'quiz_started', meta: 'oops' }),
    ).resolves.toContain('meta');
  });
});

describe('PublicEventsController', () => {
  let track: jest.Mock;
  let controller: PublicEventsController;

  beforeEach(() => {
    track = jest.fn().mockResolvedValue(undefined);
    controller = new PublicEventsController({
      track,
    } as unknown as AnalyticsService);
  });

  it('quiz_started пишется анонимно (userId = null) с src=web', async () => {
    await controller.track({
      name: 'quiz_started',
      meta: { quiz: 'critic' },
    });
    expect(track).toHaveBeenCalledWith(null, 'quiz_started', {
      quiz: 'critic',
      src: 'web',
    });
  });

  it('quiz_completed требует result из реестра этого теста', async () => {
    await controller.track({
      name: 'quiz_completed',
      meta: { quiz: 'battery', result: 'play' },
    });
    expect(track).toHaveBeenCalledWith(null, 'quiz_completed', {
      quiz: 'battery',
      result: 'play',
      src: 'web',
    });
  });

  it('src от клиента и лишние поля не проходят — src всегда web', async () => {
    await controller.track({
      name: 'quiz_started',
      meta: { quiz: 'drives', src: 'bot', userId: 42, note: 'PII' },
    });
    expect(track).toHaveBeenCalledWith(null, 'quiz_started', {
      quiz: 'drives',
      src: 'web',
    });
  });

  it('невалидная meta молча дропается, но ответ ok (не оракул)', async () => {
    const cases: Array<Record<string, unknown> | undefined> = [
      undefined,
      {},
      { quiz: 'nosuch' },
      { quiz: 'drives' }, // completed без result
      { quiz: 'drives', result: 'play' }, // result чужого теста
      { quiz: 'drives', result: 'x' },
    ];
    for (const meta of cases) {
      await expect(
        controller.track({ name: 'quiz_completed', meta }),
      ).resolves.toEqual({ ok: true });
    }
    expect(track).not.toHaveBeenCalled();
  });
});
