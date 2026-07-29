// Юнит-тест чистой функции sanitizeMeta (без Nest-обвязки) — правило №7: в
// аналитику не должен утечь произвольный/PII-объект. Интеграционная проверка
// (что контроллер реально вызывает sanitizeMeta и прокидывает результат) —
// analytics.controller.spec.ts.
import { sanitizeMeta } from './analytics-meta.sanitize';

describe('sanitizeMeta', () => {
  it('share_card: пропускает только known kind', () => {
    expect(sanitizeMeta('share_card', { kind: 'diary' })).toEqual({
      kind: 'diary',
    });
    expect(sanitizeMeta('share_card', { kind: 'evil' })).toBeUndefined();
  });

  it('share_card: выкидывает произвольные поля meta (защита от PII)', () => {
    expect(
      sanitizeMeta('share_card', {
        kind: 'weekly',
        secretDiaryText: 'мой личный текст',
      }),
    ).toEqual({ kind: 'weekly' });
  });

  it('share_result: kind + boolean ok', () => {
    expect(sanitizeMeta('share_result', { kind: 'streak', ok: false })).toEqual(
      {
        kind: 'streak',
        ok: false,
      },
    );
    expect(
      sanitizeMeta('share_result', { kind: 'streak', ok: 'yes' }),
    ).toBeUndefined();
  });

  it('crisis_card_shown/crisis_hotline_tapped: surface из allow-list', () => {
    expect(sanitizeMeta('crisis_card_shown', { surface: 'mode' })).toEqual({
      surface: 'mode',
    });
    expect(
      sanitizeMeta('crisis_hotline_tapped', { surface: 'evil' }),
    ).toBeUndefined();
  });

  it('outbox_flush: положительный count с потолком 1000', () => {
    expect(sanitizeMeta('outbox_flush', { count: 5000 })).toEqual({
      count: 1000,
    });
    expect(sanitizeMeta('outbox_flush', { count: 0 })).toBeUndefined();
  });

  it('today_focus_change: practice из allow-list', () => {
    expect(
      sanitizeMeta('today_focus_change', { practice: 'gratitude' }),
    ).toEqual({ practice: 'gratitude' });
    expect(
      sanitizeMeta('today_focus_change', { practice: 'evil' }),
    ).toBeUndefined();
  });

  it('today_streak_toggle: boolean hidden', () => {
    expect(sanitizeMeta('today_streak_toggle', { hidden: true })).toEqual({
      hidden: true,
    });
  });

  it('web_banner_open/dismiss: banner из allow-list', () => {
    expect(
      sanitizeMeta('web_banner_open', { banner: 'mode_map', extra: 'pii' }),
    ).toEqual({ banner: 'mode_map' });
    expect(
      sanitizeMeta('web_banner_dismiss', { banner: 'evil' }),
    ).toBeUndefined();
  });

  it('breath_start: meta игнорируется (событие без meta)', () => {
    expect(sanitizeMeta('breath_start', { junk: 'x' })).toBeUndefined();
  });

  it('mode_card_saved: modeId + filledFields (0..7) проходят', () => {
    expect(
      sanitizeMeta('mode_card_saved', {
        modeId: 'vulnerable_child',
        filledFields: 5,
      }),
    ).toEqual({ modeId: 'vulnerable_child', filledFields: 5 });
  });

  it('mode_card_saved: невалидный modeId → отброшено', () => {
    expect(
      sanitizeMeta('mode_card_saved', { modeId: 'evil id!', filledFields: 3 }),
    ).toBeUndefined();
  });

  it('mode_card_saved: filledFields вне 0..7 → отброшено', () => {
    expect(
      sanitizeMeta('mode_card_saved', {
        modeId: 'vulnerable_child',
        filledFields: 8,
      }),
    ).toBeUndefined();
  });

  it('mode_card_saved: свободный текст в meta не пропускается (защита от PII)', () => {
    expect(
      sanitizeMeta('mode_card_saved', {
        modeId: 'vulnerable_child',
        filledFields: 5,
        healthyView: 'секретный текст пользователя',
      }),
    ).toEqual({ modeId: 'vulnerable_child', filledFields: 5 });
  });

  it('без meta — undefined для любого события', () => {
    expect(sanitizeMeta('share_card', undefined)).toBeUndefined();
  });
});
