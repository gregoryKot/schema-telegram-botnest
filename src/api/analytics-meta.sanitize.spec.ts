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

  it('mode_entry_saved: filledFields (0..7) + filledHealthy проходят', () => {
    expect(
      sanitizeMeta('mode_entry_saved', {
        filledFields: 5,
        filledHealthy: true,
      }),
    ).toEqual({ filledFields: 5, filledHealthy: true });
  });

  it('mode_entry_saved: filledFields вне 0..7 → отброшено', () => {
    expect(
      sanitizeMeta('mode_entry_saved', {
        filledFields: 9,
        filledHealthy: true,
      }),
    ).toBeUndefined();
  });

  it('mode_entry_saved: filledHealthy не boolean → отброшено', () => {
    expect(
      sanitizeMeta('mode_entry_saved', {
        filledFields: 3,
        filledHealthy: 'yes',
      }),
    ).toBeUndefined();
  });

  it('mode_entry_saved: свободный текст в meta не пропускается (защита от PII)', () => {
    expect(
      sanitizeMeta('mode_entry_saved', {
        filledFields: 5,
        filledHealthy: true,
        text: 'секретный текст пользователя',
      }),
    ).toEqual({ filledFields: 5, filledHealthy: true });
  });

  it('mode_test_completed: валидный modeId → {modeId}', () => {
    expect(
      sanitizeMeta('mode_test_completed', { modeId: 'detached_protector' }),
    ).toEqual({ modeId: 'detached_protector' });
  });

  it('mode_test_completed: невалидный modeId (цифры/пробелы/длина) → undefined', () => {
    expect(
      sanitizeMeta('mode_test_completed', { modeId: 'evil id 123' }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('mode_test_completed', { modeId: 'a'.repeat(65) }),
    ).toBeUndefined();
  });

  it('mode_test_completed: лишнее поле отброшено', () => {
    expect(
      sanitizeMeta('mode_test_completed', {
        modeId: 'vulnerable_child',
        note: 'посторонний текст',
      }),
    ).toEqual({ modeId: 'vulnerable_child' });
  });

  it('warm_words_open: валидный count (0..1000) проходит', () => {
    expect(sanitizeMeta('warm_words_open', { count: 12 })).toEqual({
      count: 12,
    });
    expect(sanitizeMeta('warm_words_open', { count: 0 })).toEqual({
      count: 0,
    });
    expect(sanitizeMeta('warm_words_open', { count: 1000 })).toEqual({
      count: 1000,
    });
  });

  it('warm_words_open: невалидный/отсутствующий count — событие остаётся, meta пустое', () => {
    expect(sanitizeMeta('warm_words_open', { count: 1001 })).toEqual({});
    expect(sanitizeMeta('warm_words_open', { count: -1 })).toEqual({});
    expect(sanitizeMeta('warm_words_open', { count: 'many' })).toEqual({});
    expect(sanitizeMeta('warm_words_open', {})).toEqual({});
  });

  it('warm_words_open: лишние поля срезаются', () => {
    expect(
      sanitizeMeta('warm_words_open', { count: 3, note: 'секретный текст' }),
    ).toEqual({ count: 3 });
  });

  it('mode_chain_followup: from + to из allow-list формата проходят', () => {
    expect(
      sanitizeMeta('mode_chain_followup', {
        from: 'vulnerable_child',
        to: 'punitive_parent',
      }),
    ).toEqual({ from: 'vulnerable_child', to: 'punitive_parent' });
  });

  it('mode_chain_followup: невалидный/отсутствующий from или to → отброшено целиком', () => {
    expect(
      sanitizeMeta('mode_chain_followup', {
        from: 'evil id!',
        to: 'punitive_parent',
      }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('mode_chain_followup', { from: 'vulnerable_child' }),
    ).toBeUndefined();
    expect(sanitizeMeta('mode_chain_followup', {})).toBeUndefined();
  });

  it('mode_chain_followup: лишние поля срезаются', () => {
    expect(
      sanitizeMeta('mode_chain_followup', {
        from: 'vulnerable_child',
        to: 'punitive_parent',
        note: 'секретный текст',
      }),
    ).toEqual({ from: 'vulnerable_child', to: 'punitive_parent' });
  });

  it('mode_doubt_opened: валидный modeId → {modeId}', () => {
    expect(
      sanitizeMeta('mode_doubt_opened', { modeId: 'detached_protector' }),
    ).toEqual({ modeId: 'detached_protector' });
  });

  it('mode_doubt_opened: невалидный modeId (цифры/пробелы/длина) → undefined', () => {
    expect(
      sanitizeMeta('mode_doubt_opened', { modeId: 'evil id 123' }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('mode_doubt_opened', { modeId: 'a'.repeat(65) }),
    ).toBeUndefined();
  });

  it('mode_doubt_opened: лишнее поле отброшено', () => {
    expect(
      sanitizeMeta('mode_doubt_opened', {
        modeId: 'vulnerable_child',
        note: 'посторонний текст',
      }),
    ).toEqual({ modeId: 'vulnerable_child' });
  });

  it('mode_doubt_switched: from + to из allow-list формата проходят', () => {
    expect(
      sanitizeMeta('mode_doubt_switched', {
        from: 'vulnerable_child',
        to: 'helpless_surrenderer',
      }),
    ).toEqual({ from: 'vulnerable_child', to: 'helpless_surrenderer' });
  });

  it('mode_doubt_switched: невалидный/отсутствующий from или to → отброшено целиком', () => {
    expect(
      sanitizeMeta('mode_doubt_switched', {
        from: 'evil id!',
        to: 'helpless_surrenderer',
      }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('mode_doubt_switched', { from: 'vulnerable_child' }),
    ).toBeUndefined();
    expect(sanitizeMeta('mode_doubt_switched', {})).toBeUndefined();
  });

  it('mode_doubt_switched: лишние поля срезаются', () => {
    expect(
      sanitizeMeta('mode_doubt_switched', {
        from: 'vulnerable_child',
        to: 'helpless_surrenderer',
        note: 'секретный текст',
      }),
    ).toEqual({ from: 'vulnerable_child', to: 'helpless_surrenderer' });
  });

  it('plus_action: action из allow-list проходит', () => {
    expect(sanitizeMeta('plus_action', { action: 'tracker' })).toEqual({
      action: 'tracker',
    });
    expect(sanitizeMeta('plus_action', { action: 'plans' })).toEqual({
      action: 'plans',
    });
  });

  it('plus_action: неизвестный action → отброшено', () => {
    expect(sanitizeMeta('plus_action', { action: 'evil' })).toBeUndefined();
  });

  it('plus_action: лишние поля срезаются', () => {
    expect(
      sanitizeMeta('plus_action', {
        action: 'breathing',
        note: 'секретный текст',
      }),
    ).toEqual({ action: 'breathing' });
  });

  it('quick_action_toggle: валидные action + hidden + surface проходят', () => {
    expect(
      sanitizeMeta('quick_action_toggle', {
        action: 'plans',
        hidden: true,
        surface: 'plus',
      }),
    ).toEqual({ action: 'plans', hidden: true, surface: 'plus' });
    expect(
      sanitizeMeta('quick_action_toggle', {
        action: 'tasks',
        hidden: false,
        surface: 'tools',
      }),
    ).toEqual({ action: 'tasks', hidden: false, surface: 'tools' });
  });

  it('quick_action_toggle: неизвестный action → отброшено целиком', () => {
    expect(
      sanitizeMeta('quick_action_toggle', {
        action: 'evil',
        hidden: true,
        surface: 'plus',
      }),
    ).toBeUndefined();
  });

  it('quick_action_toggle: hidden не boolean → отброшено', () => {
    expect(
      sanitizeMeta('quick_action_toggle', {
        action: 'plans',
        hidden: 'yes',
        surface: 'plus',
      }),
    ).toBeUndefined();
  });

  it('quick_action_toggle: неизвестный surface → отброшено', () => {
    expect(
      sanitizeMeta('quick_action_toggle', {
        action: 'plans',
        hidden: true,
        surface: 'evil',
      }),
    ).toBeUndefined();
  });

  it('quick_action_toggle: недостающее поле → отброшено', () => {
    expect(
      sanitizeMeta('quick_action_toggle', { action: 'plans', hidden: true }),
    ).toBeUndefined();
    expect(sanitizeMeta('quick_action_toggle', {})).toBeUndefined();
  });

  it('quick_action_toggle: лишние поля срезаются (защита от PII)', () => {
    expect(
      sanitizeMeta('quick_action_toggle', {
        action: 'plans',
        hidden: true,
        surface: 'plus',
        note: 'секретный текст пользователя',
      }),
    ).toEqual({ action: 'plans', hidden: true, surface: 'plus' });
  });

  it('plus_open: meta игнорируется (событие без meta)', () => {
    expect(sanitizeMeta('plus_open', { junk: 'x' })).toBeUndefined();
  });

  // ── Перенос аккаунта из мессенджера (account_link_*) ────────────────────
  // Сюда мог бы уехать текст ошибки или адрес — а meta не шифруется. Поэтому
  // проверяем именно срезание всего лишнего, а не только happy path.
  it('account_link_started: пропускает только известный мессенджер', () => {
    expect(sanitizeMeta('account_link_started', { host: 'max' })).toEqual({
      host: 'max',
    });
    expect(
      sanitizeMeta('account_link_started', { host: 'вконтакте' }),
    ).toBeUndefined();
    expect(sanitizeMeta('account_link_started', {})).toBeUndefined();
  });

  it('account_link_started: лишние поля срезаются', () => {
    expect(
      sanitizeMeta('account_link_started', {
        host: 'max',
        code: 'ABCD2345',
        userName: 'Гриша',
      }),
    ).toEqual({ host: 'max' });
  });

  it('account_link_confirmed: нужен и мессенджер, и признак переноса', () => {
    expect(
      sanitizeMeta('account_link_confirmed', {
        host: 'telegram',
        merged: true,
      }),
    ).toEqual({ host: 'telegram', merged: true });
    expect(
      sanitizeMeta('account_link_confirmed', { host: 'telegram' }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('account_link_confirmed', { host: 'max', merged: 'yes' }),
    ).toBeUndefined();
  });

  it('account_link_failed: причина — только из списка, свободный текст не проходит', () => {
    expect(
      sanitizeMeta('account_link_failed', { host: 'max', reason: 'expired' }),
    ).toEqual({ host: 'max', reason: 'expired' });
    expect(
      sanitizeMeta('account_link_failed', {
        host: 'max',
        reason: 'PrismaClientKnownRequestError: user 12345 not found',
      }),
    ).toBeUndefined();
  });

  it('без meta — undefined для любого события', () => {
    expect(sanitizeMeta('share_card', undefined)).toBeUndefined();
  });
});
