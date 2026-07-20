// Тест санитизации meta НОВЫХ событий в контроллере /api/event (правило №7: в
// аналитику не должен утечь произвольный/PII-объект). share_card уже покрыт в
// dto/analytics.dto.spec.ts — здесь только share_result / crisis / outbox.
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
  return { track, fire };
}

describe('AnalyticsController — sanitizeMeta (новые события)', () => {
  it('share_result: kind + boolean ok', async () => {
    const { track, fire } = setup();
    await fire({ name: 'share_result', meta: { kind: 'streak', ok: false } });
    expect(track).toHaveBeenCalledWith(7n, 'share_result', {
      kind: 'streak',
      ok: false,
    });
  });

  it('share_result: ok не boolean → отброшено', async () => {
    const { track, fire } = setup();
    await fire({ name: 'share_result', meta: { kind: 'streak', ok: 'yes' } });
    expect(track).toHaveBeenCalledWith(7n, 'share_result', undefined);
  });

  it('crisis_card_shown: surface из allow-list', async () => {
    const { track, fire } = setup();
    await fire({ name: 'crisis_card_shown', meta: { surface: 'mode' } });
    expect(track).toHaveBeenCalledWith(7n, 'crisis_card_shown', {
      surface: 'mode',
    });
  });

  it('crisis_hotline_tapped: неизвестный surface → отброшено', async () => {
    const { track, fire } = setup();
    await fire({ name: 'crisis_hotline_tapped', meta: { surface: 'evil' } });
    expect(track).toHaveBeenCalledWith(7n, 'crisis_hotline_tapped', undefined);
  });

  it.each(['letter', 'safe_place', 'weekly', 'belief_check', 'flashcard'])(
    'crisis_card_shown: новый surface %s из allow-list проходит',
    async (surface) => {
      const { track, fire } = setup();
      await fire({ name: 'crisis_card_shown', meta: { surface } });
      expect(track).toHaveBeenCalledWith(7n, 'crisis_card_shown', { surface });
    },
  );

  it('crisis_card_shown: неизвестный surface (junk) → meta отброшена целиком', async () => {
    const { track, fire } = setup();
    await fire({ name: 'crisis_card_shown', meta: { surface: 'junk' } });
    expect(track).toHaveBeenCalledWith(7n, 'crisis_card_shown', undefined);
  });

  it('outbox_flush: положительный count с потолком 1000', async () => {
    const { track, fire } = setup();
    await fire({ name: 'outbox_flush', meta: { count: 5000 } });
    expect(track).toHaveBeenCalledWith(7n, 'outbox_flush', { count: 1000 });
  });

  it('outbox_flush: count ≤ 0 или не число → отброшено', async () => {
    const { track, fire } = setup();
    await fire({ name: 'outbox_flush', meta: { count: 0 } });
    expect(track).toHaveBeenCalledWith(7n, 'outbox_flush', undefined);
  });

  it('today_focus_change: practice из allow-list', async () => {
    const { track, fire } = setup();
    await fire({ name: 'today_focus_change', meta: { practice: 'gratitude' } });
    expect(track).toHaveBeenCalledWith(7n, 'today_focus_change', {
      practice: 'gratitude',
    });
  });

  it('today_focus_change: неизвестная practice → отброшено', async () => {
    const { track, fire } = setup();
    await fire({ name: 'today_focus_change', meta: { practice: 'evil' } });
    expect(track).toHaveBeenCalledWith(7n, 'today_focus_change', undefined);
  });

  it('today_streak_toggle: boolean hidden', async () => {
    const { track, fire } = setup();
    await fire({ name: 'today_streak_toggle', meta: { hidden: true } });
    expect(track).toHaveBeenCalledWith(7n, 'today_streak_toggle', {
      hidden: true,
    });
  });

  it('breath_start: meta игнорируется (событие без meta)', async () => {
    const { track, fire } = setup();
    await fire({ name: 'breath_start', meta: { junk: 'x' } });
    expect(track).toHaveBeenCalledWith(7n, 'breath_start', undefined);
  });
});
