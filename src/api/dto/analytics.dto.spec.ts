// DTO + санитизация meta для POST /api/event (правило №6 + защита от PII в meta).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TrackEventDto } from './analytics.dto';
import { AnalyticsController } from '../analytics.controller';
import type { AnalyticsService } from '../../analytics/analytics.service';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(TrackEventDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('TrackEventDto', () => {
  it('валидное событие проходит', async () => {
    await expect(
      errorsFor({ name: 'share_card', meta: { kind: 'weekly' } }),
    ).resolves.toEqual([]);
  });

  it('без meta проходит', async () => {
    await expect(errorsFor({ name: 'share_card' })).resolves.toEqual([]);
  });

  it('неизвестное имя — отказ', async () => {
    await expect(errorsFor({ name: 'hack_event' })).resolves.toContain('name');
  });

  it('meta не объект — отказ', async () => {
    await expect(
      errorsFor({ name: 'share_card', meta: 'oops' }),
    ).resolves.toContain('meta');
  });
});

describe('AnalyticsController — санитизация meta', () => {
  const uid = 7n;
  const req = { webUser: { userId: uid } } as never;

  function makeController() {
    const track = jest.fn(async () => undefined);
    const controller = new AnalyticsController({
      track,
    } as unknown as AnalyticsService);
    return { controller, track };
  }

  it('пропускает только known kind', async () => {
    const { controller, track } = makeController();
    await controller.track(req, {
      name: 'share_card',
      meta: { kind: 'diary' },
    });
    expect(track).toHaveBeenCalledWith(uid, 'share_card', { kind: 'diary' });
  });

  it('выкидывает произвольные поля meta (защита от PII)', async () => {
    const { controller, track } = makeController();
    await controller.track(req, {
      name: 'share_card',
      meta: { kind: 'weekly', secretDiaryText: 'мой личный текст' },
    });
    // в track уходит ТОЛЬКО kind
    expect(track).toHaveBeenCalledWith(uid, 'share_card', { kind: 'weekly' });
  });

  it('неизвестный kind → meta отбрасывается', async () => {
    const { controller, track } = makeController();
    await controller.track(req, {
      name: 'share_card',
      meta: { kind: 'evil' },
    });
    expect(track).toHaveBeenCalledWith(uid, 'share_card', undefined);
  });

  it('возвращает { ok: true }', async () => {
    const { controller } = makeController();
    await expect(
      controller.track(req, { name: 'share_card', meta: { kind: 'streak' } }),
    ).resolves.toEqual({ ok: true });
  });
});
