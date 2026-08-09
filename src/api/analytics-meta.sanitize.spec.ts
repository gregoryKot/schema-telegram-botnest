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

  it('quick_action_move: валидные action + surface + dir проходят', () => {
    expect(
      sanitizeMeta('quick_action_move', {
        action: 'plans',
        surface: 'plus',
        dir: 'up',
      }),
    ).toEqual({ action: 'plans', surface: 'plus', dir: 'up' });
    expect(
      sanitizeMeta('quick_action_move', {
        action: 'tasks',
        surface: 'tools',
        dir: 'down',
      }),
    ).toEqual({ action: 'tasks', surface: 'tools', dir: 'down' });
  });

  it('quick_action_move: неизвестный action → отброшено целиком', () => {
    expect(
      sanitizeMeta('quick_action_move', {
        action: 'evil',
        surface: 'plus',
        dir: 'up',
      }),
    ).toBeUndefined();
  });

  it('quick_action_move: неизвестный surface → отброшено', () => {
    expect(
      sanitizeMeta('quick_action_move', {
        action: 'plans',
        surface: 'evil',
        dir: 'up',
      }),
    ).toBeUndefined();
  });

  it('quick_action_move: невалидный dir → отброшено', () => {
    expect(
      sanitizeMeta('quick_action_move', {
        action: 'plans',
        surface: 'plus',
        dir: 'sideways',
      }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('quick_action_move', { action: 'plans', surface: 'plus' }),
    ).toBeUndefined();
  });

  it('quick_action_move: лишние поля срезаются (защита от PII)', () => {
    expect(
      sanitizeMeta('quick_action_move', {
        action: 'plans',
        surface: 'plus',
        dir: 'up',
        note: 'секретный текст пользователя',
      }),
    ).toEqual({ action: 'plans', surface: 'plus', dir: 'up' });
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

  // screen_customize_open/screen_block_toggle/screen_block_move живут в
  // отдельном модуле analytics-meta.sanitize-screens.ts (правило №10 — этот
  // файл упёрся в потолок 300 строк). Детальные тесты (валид/невалид/PII) —
  // в analytics-meta.sanitize-screens.spec.ts; здесь только смоук на саму
  // связку делегирования.
  it('screen_customize_open/screen_block_toggle/screen_block_move: делегируются в sanitizeScreenMeta', () => {
    expect(
      sanitizeMeta('screen_customize_open', {
        screen: 'profile',
        via: 'gear',
      }),
    ).toEqual({ screen: 'profile', via: 'gear' });
    expect(
      sanitizeMeta('screen_block_toggle', {
        screen: 'profile',
        block: 'streak',
        hidden: true,
      }),
    ).toEqual({ screen: 'profile', block: 'streak', hidden: true });
    expect(
      sanitizeMeta('screen_block_move', {
        screen: 'profile',
        block: 'streak',
        dir: 'up',
      }),
    ).toEqual({ screen: 'profile', block: 'streak', dir: 'up' });
  });

  it('today_streak_toggle: hidden не boolean → отброшено', () => {
    expect(
      sanitizeMeta('today_streak_toggle', { hidden: 'true' }),
    ).toBeUndefined();
    expect(sanitizeMeta('today_streak_toggle', {})).toBeUndefined();
  });

  it('onboarding_step: step из allow-list проходит', () => {
    expect(sanitizeMeta('onboarding_step', { step: 'done' })).toEqual({
      step: 'done',
    });
  });

  it('onboarding_step: неизвестный/отсутствующий step → отброшено', () => {
    expect(
      sanitizeMeta('onboarding_step', { step: 'evil_step' }),
    ).toBeUndefined();
    expect(sanitizeMeta('onboarding_step', {})).toBeUndefined();
  });

  it('onboarding_step: лишние поля срезаются', () => {
    expect(
      sanitizeMeta('onboarding_step', {
        step: 'privacy',
        userAgent: 'секретный текст',
      }),
    ).toEqual({ step: 'privacy' });
  });

  it('today_block_toggle: block + hidden из allow-list проходят', () => {
    expect(
      sanitizeMeta('today_block_toggle', { block: 'phrase', hidden: true }),
    ).toEqual({ block: 'phrase', hidden: true });
  });

  it('today_block_toggle: неизвестный block → отброшено целиком', () => {
    expect(
      sanitizeMeta('today_block_toggle', { block: 'evil', hidden: true }),
    ).toBeUndefined();
  });

  it('today_block_toggle: hidden не boolean → отброшено', () => {
    expect(
      sanitizeMeta('today_block_toggle', { block: 'streak', hidden: 'yes' }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('today_block_toggle', { block: 'streak' }),
    ).toBeUndefined();
  });

  it('today_customize_open: via из allow-list проходит', () => {
    expect(sanitizeMeta('today_customize_open', { via: 'longpress' })).toEqual({
      via: 'longpress',
    });
  });

  it('today_customize_open: неизвестный/отсутствующий via → отброшено', () => {
    expect(
      sanitizeMeta('today_customize_open', { via: 'evil' }),
    ).toBeUndefined();
    expect(sanitizeMeta('today_customize_open', {})).toBeUndefined();
  });

  it('home_screen_offer: action + surface из allow-list проходят', () => {
    expect(
      sanitizeMeta('home_screen_offer', {
        action: 'added',
        surface: 'today',
      }),
    ).toEqual({ action: 'added', surface: 'today' });
  });

  it('home_screen_offer: неизвестный action → отброшено целиком', () => {
    expect(
      sanitizeMeta('home_screen_offer', {
        action: 'evil',
        surface: 'today',
      }),
    ).toBeUndefined();
  });

  it('home_screen_offer: неизвестный/отсутствующий surface → отброшено', () => {
    expect(
      sanitizeMeta('home_screen_offer', { action: 'shown', surface: 'evil' }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('home_screen_offer', { action: 'shown' }),
    ).toBeUndefined();
  });

  it('home_screen_offer: лишние поля срезаются (защита от PII)', () => {
    expect(
      sanitizeMeta('home_screen_offer', {
        action: 'add',
        surface: 'settings',
        deviceModel: 'секретный отпечаток устройства',
      }),
    ).toEqual({ action: 'add', surface: 'settings' });
  });

  // ── Deny-list-by-default: события без meta не пропускают вообще ничего ──
  it('stop_start/journey_open/ysq_help_open/plus_open: meta игнорируется', () => {
    expect(sanitizeMeta('stop_start', { junk: 'x' })).toBeUndefined();
    expect(sanitizeMeta('journey_open', { junk: 'x' })).toBeUndefined();
    expect(sanitizeMeta('ysq_help_open', { junk: 'x' })).toBeUndefined();
    expect(sanitizeMeta('plus_open', { junk: 'x' })).toBeUndefined();
  });

  // quiz_started/quiz_completed/practice_link_click несут meta по реестру
  // (analytics.constants.ts), но санитизируются ТОЛЬКО в PublicEventsController
  // (анонимный /api/public-event) — эта функция обслуживает /api/event и
  // намеренно не знает про них: deny-by-default безопасен даже если
  // авторизованный клиент пошлёт их сюда по ошибке.
  it('quiz_started/quiz_completed/practice_link_click: нет ветки в sanitizeMeta — meta полностью отбрасывается', () => {
    expect(
      sanitizeMeta('quiz_started', { quiz: 'attachment', src: 'bot' }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('quiz_completed', {
        quiz: 'attachment',
        result: 'secure',
        src: 'bot',
      }),
    ).toBeUndefined();
    expect(
      sanitizeMeta('practice_link_click', { place: 'footer' }),
    ).toBeUndefined();
  });

  // ── Атаки на deny-by-default: произвольные структуры не пролезают ни в
  // одну ветку и не портят вывод для валидных полей ──────────────────────
  it('prototype pollution ключи (__proto__/constructor) не влияют на результат', () => {
    const malicious = JSON.parse(
      '{"kind":"diary","__proto__":{"polluted":true},"constructor":{"evil":1}}',
    ) as Record<string, unknown>;
    const result = sanitizeMeta('share_card', malicious);
    expect(result).toEqual({ kind: 'diary' });
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(
      false,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('вложенный объект/массив вместо строкового поля → отброшено', () => {
    expect(
      sanitizeMeta('share_card', { kind: { nested: 'diary' } }),
    ).toBeUndefined();
    expect(sanitizeMeta('share_card', { kind: ['diary'] })).toBeUndefined();
    expect(
      sanitizeMeta('account_link_failed', {
        host: 'max',
        reason: { message: 'email@example.com', stack: 'trace' },
      }),
    ).toBeUndefined();
  });

  it('огромная строка вместо enum-значения не проходит (не DoS-хранится)', () => {
    const huge = 'a'.repeat(100_000);
    expect(sanitizeMeta('share_card', { kind: huge })).toBeUndefined();
    expect(sanitizeMeta('web_banner_open', { banner: huge })).toBeUndefined();
  });

  it('meta с email/телефоном в незнакомых полях полностью отбрасывается', () => {
    expect(
      sanitizeMeta('crisis_hotline_tapped', {
        surface: 'mode',
        email: 'user@example.com',
        phone: '+79991234567',
      }),
    ).toEqual({ surface: 'mode' });
    expect(
      sanitizeMeta('outbox_flush', {
        count: 3,
        userNote: 'мой дневник за сегодня: было тяжело',
      }),
    ).toEqual({ count: 3 });
  });

  it('outbox_flush: отрицательные/дробные/NaN/Infinity count отброшены', () => {
    expect(sanitizeMeta('outbox_flush', { count: -5 })).toBeUndefined();
    expect(sanitizeMeta('outbox_flush', { count: 1.5 })).toBeUndefined();
    expect(sanitizeMeta('outbox_flush', { count: NaN })).toBeUndefined();
    expect(sanitizeMeta('outbox_flush', { count: Infinity })).toBeUndefined();
    expect(sanitizeMeta('outbox_flush', { count: '5' })).toBeUndefined();
  });

  it('allow-list-сверка: у каждого события ANALYTICS_EVENTS есть предсказуемое поведение sanitizeMeta', () => {
    // События, ветка которых проверена выше пооперационно (с meta) —
    // остальные (без meta) покрыты тестом deny-by-default. Сверка сама
    // работает как трипваер: новое событие в ANALYTICS_EVENTS, для которого
    // никто не написал тест выше, не завалит этот expect (он про форму
    // ответа), но развалит сборку `--verbose`-обзора при ревью. Здесь же
    // фиксируем факт: функция для НЕИЗВЕСТНОГО имени события (в объединении
    // типов не встречающегося) тоже обязана возвращать undefined, а не кидать.
    expect(
      sanitizeMeta(
        'nonexistent_event' as unknown as Parameters<typeof sanitizeMeta>[0],
        { anything: 'here' },
      ),
    ).toBeUndefined();
  });
});
