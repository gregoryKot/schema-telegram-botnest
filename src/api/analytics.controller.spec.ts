// Плагин-тест контроллера /api/event: реально вызывает sanitizeMeta и
// прокидывает результат в AnalyticsService.track (правило №7). Ветвление по
// каждому событию покрыто напрямую в analytics-meta.sanitize.spec.ts —
// здесь только связка контроллер → sanitizeMeta → track.
import { AnalyticsController } from './analytics.controller';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { TrackEventDto } from './dto/analytics.dto';

function setup() {
  const track = jest.fn(async () => undefined);
  const controller = new AnalyticsController({
    track,
  } as unknown as AnalyticsService);
  const req = { webUser: { userId: 7n } } as never;
  const fire = (body: Record<string, unknown>) =>
    controller.track(req, body as unknown as TrackEventDto);
  return { controller, req, track, fire };
}

describe('AnalyticsController — делегирует sanitizeMeta и track', () => {
  it('известное meta.kind проходит в track как есть', async () => {
    const { track, fire } = setup();
    await fire({ name: 'share_card', meta: { kind: 'diary' } });
    expect(track).toHaveBeenCalledWith(7n, 'share_card', { kind: 'diary' });
  });

  it('произвольные поля meta не долетают до track (защита от PII)', async () => {
    const { track, fire } = setup();
    await fire({
      name: 'share_card',
      meta: { kind: 'weekly', secretDiaryText: 'мой личный текст' },
    });
    expect(track).toHaveBeenCalledWith(7n, 'share_card', { kind: 'weekly' });
  });

  it('неизвестное значение → meta в track приходит undefined', async () => {
    const { track, fire } = setup();
    await fire({ name: 'crisis_card_shown', meta: { surface: 'junk' } });
    expect(track).toHaveBeenCalledWith(7n, 'crisis_card_shown', undefined);
  });

  it('mode_card_saved: modeId + filledFields долетают до track', async () => {
    const { track, fire } = setup();
    await fire({
      name: 'mode_card_saved',
      meta: { modeId: 'vulnerable_child', filledFields: 5 },
    });
    expect(track).toHaveBeenCalledWith(7n, 'mode_card_saved', {
      modeId: 'vulnerable_child',
      filledFields: 5,
    });
  });

  it('возвращает { ok: true }', async () => {
    const { controller, req } = setup();
    await expect(
      controller.track(req, { name: 'share_card', meta: { kind: 'streak' } }),
    ).resolves.toEqual({ ok: true });
  });

  it('stop_start: meta игнорируется (событие без meta)', async () => {
    const { track, fire } = setup();
    await fire({ name: 'stop_start', meta: { junk: 'x' } });
    expect(track).toHaveBeenCalledWith(7n, 'stop_start', undefined);
  });
});

// D4 (аудит 2026-10), на шве: настоящий контроллер → настоящий сервис →
// поддельная БД. Контроллер передаёт uid (он нужен остальным событиям), а
// кризисные события обязаны лечь в таблицу без него.
describe('AnalyticsController → AnalyticsService: кризисные события анонимны', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AnalyticsService: Real } = require('../analytics/analytics.service');

  function wire() {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new Real({ analyticsEvent: { create } });
    const controller = new AnalyticsController(service);
    const req = { webUser: { userId: 7n } } as never;
    return {
      create,
      fire: (body: Record<string, unknown>) =>
        controller.track(req, body as unknown as TrackEventDto),
    };
  }

  it('crisis_card_shown с uid → строка с userId = null', async () => {
    const { create, fire } = wire();
    await fire({ name: 'crisis_card_shown', meta: { surface: 'note' } });
    expect(create.mock.calls[0][0].data.userId).toBeNull();
  });

  it('обычное событие (share_card) → строка с userId', async () => {
    const { create, fire } = wire();
    await fire({ name: 'share_card', meta: { kind: 'weekly' } });
    expect(create.mock.calls[0][0].data.userId).toBe(7n);
  });
});
