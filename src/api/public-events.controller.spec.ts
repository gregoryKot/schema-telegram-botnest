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

  it('quiz_started / quiz_completed / practice_link_click проходят', async () => {
    await expect(
      errorsFor({ name: 'quiz_started', meta: { quiz: 'drives' } }),
    ).resolves.toEqual([]);
    await expect(errorsFor({ name: 'quiz_completed' })).resolves.toEqual([]);
    await expect(
      errorsFor({ name: 'practice_link_click', meta: { place: 'author' } }),
    ).resolves.toEqual([]);
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

  it('practice_link_click пишется анонимно с местом клика из allow-list', async () => {
    for (const place of ['author', 'footer', 'faq', 'quiz']) {
      await controller.track({ name: 'practice_link_click', meta: { place } });
      expect(track).toHaveBeenLastCalledWith(null, 'practice_link_click', {
        place,
      });
    }
  });

  it('practice_link_click: лишние поля отрезаются, остаётся только place', async () => {
    await controller.track({
      name: 'practice_link_click',
      meta: { place: 'faq', userId: 7, note: 'PII' },
    });
    expect(track).toHaveBeenCalledWith(null, 'practice_link_click', {
      place: 'faq',
    });
  });

  it('practice_link_click с неизвестным place молча дропается (ответ ok)', async () => {
    const cases: Array<Record<string, unknown> | undefined> = [
      undefined,
      {},
      { place: 'hack' },
      { place: 42 },
    ];
    for (const meta of cases) {
      await expect(
        controller.track({ name: 'practice_link_click', meta }),
      ).resolves.toEqual({ ok: true });
    }
    expect(track).not.toHaveBeenCalled();
  });
});
