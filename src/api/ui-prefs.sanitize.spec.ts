// Юнит-тест чистой функции sanitizeUiPrefs (без Nest-обвязки) — серверное
// зеркало кастомизации мини-аппа (User.uiPrefs). Санитизация «всё или
// ничего» ПО КЛЮЧУ: невалидное значение отбрасывает только свой ключ, не
// весь объект.
import { sanitizeUiPrefs, SYNCED_PREF_KEYS } from './ui-prefs.sanitize';

describe('sanitizeUiPrefs', () => {
  it('реестр ключей — 14 штук, ровно как в зафиксированном контракте', () => {
    expect(SYNCED_PREF_KEYS).toEqual([
      'today_focus_practice',
      'today_streak_hidden',
      'today_phrase_hidden',
      'today_secondary_hidden',
      'today_therapist_banner_hidden',
      'quick_actions_hidden_plus',
      'quick_actions_order_plus',
      'quick_actions_hidden_tools',
      'quick_actions_order_tools',
      'screen_hidden_profile',
      'screen_hidden_patterns',
      'screen_order_profile',
      'screen_order_patterns',
      'screen_order_today',
    ]);
  });

  it('не-объект (null/массив/примитив) → undefined, сохранённые настройки не трогаем', () => {
    expect(sanitizeUiPrefs(null)).toBeUndefined();
    expect(sanitizeUiPrefs(undefined)).toBeUndefined();
    expect(sanitizeUiPrefs('string')).toBeUndefined();
    expect(sanitizeUiPrefs(42)).toBeUndefined();
    expect(sanitizeUiPrefs(['a', 'b'])).toBeUndefined();
  });

  it('пустой объект → пустой объект (валидная «очистка всех ключей»)', () => {
    expect(sanitizeUiPrefs({})).toEqual({});
  });

  it('неизвестные ключи отбрасываются, известные проходят', () => {
    expect(
      sanitizeUiPrefs({
        today_streak_hidden: '1',
        evil_key: 'x',
        __proto__: 'ignored',
      }),
    ).toEqual({ today_streak_hidden: '1' });
  });

  it('today_focus_practice: валидное значение из TODAY_FOCUS_PRACTICES проходит, остальное — нет', () => {
    expect(sanitizeUiPrefs({ today_focus_practice: 'tracker' })).toEqual({
      today_focus_practice: 'tracker',
    });
    expect(sanitizeUiPrefs({ today_focus_practice: 'mode' })).toEqual({
      today_focus_practice: 'mode',
    });
    expect(sanitizeUiPrefs({ today_focus_practice: 'unknown' })).toEqual({});
  });

  it('today_*_hidden: строго "1" или "0", остальное отбрасывается', () => {
    for (const key of [
      'today_streak_hidden',
      'today_phrase_hidden',
      'today_secondary_hidden',
      'today_therapist_banner_hidden',
    ] as const) {
      expect(sanitizeUiPrefs({ [key]: '1' })).toEqual({ [key]: '1' });
      expect(sanitizeUiPrefs({ [key]: '0' })).toEqual({ [key]: '0' });
      expect(sanitizeUiPrefs({ [key]: 'true' })).toEqual({});
      expect(sanitizeUiPrefs({ [key]: true as unknown as string })).toEqual({});
    }
  });

  it('quick_actions_hidden_plus/order_plus/hidden_tools/order_tools: JSON-массив id ⊆ QUICK_ACTION_IDS, длина ≤ 32', () => {
    for (const key of [
      'quick_actions_hidden_plus',
      'quick_actions_order_plus',
      'quick_actions_hidden_tools',
      'quick_actions_order_tools',
    ] as const) {
      expect(
        sanitizeUiPrefs({ [key]: JSON.stringify(['tracker', 'breathing']) }),
      ).toEqual({ [key]: JSON.stringify(['tracker', 'breathing']) });
      // Неизвестный id внутри массива — ключ целиком отбрасывается.
      expect(sanitizeUiPrefs({ [key]: JSON.stringify(['nope']) })).toEqual({});
      // Не JSON вовсе.
      expect(sanitizeUiPrefs({ [key]: 'not-json' })).toEqual({});
      // JSON, но не массив.
      expect(sanitizeUiPrefs({ [key]: JSON.stringify({ a: 1 }) })).toEqual({});
      // Длина сверх лимита (32).
      expect(
        sanitizeUiPrefs({
          [key]: JSON.stringify(Array.from({ length: 33 }, () => 'tracker')),
        }),
      ).toEqual({});
    }
  });

  it('screen_hidden_*/screen_order_*: JSON-массив id ⊆ SCREEN_BLOCK_IDS, длина ≤ 16, неизвестные id тихо фильтруются', () => {
    for (const key of [
      'screen_hidden_profile',
      'screen_hidden_patterns',
      'screen_order_profile',
      'screen_order_patterns',
      'screen_order_today',
    ] as const) {
      expect(sanitizeUiPrefs({ [key]: JSON.stringify(['streak']) })).toEqual({
        [key]: JSON.stringify(['streak']),
      });
      // Регрессия «удалили id из реестра блоков» (my_schemas/my_modes слились
      // в лист «Мой портрет»): устройство, ещё не подтянувшее новый реестр,
      // может прислать массив с чужим id вперемешку с валидными — ключ не
      // отбрасывается целиком, невалидный элемент тихо выпадает, остальное
      // (порядок валидных id) сохраняется как было.
      expect(
        sanitizeUiPrefs({
          [key]: JSON.stringify(['portrait', 'my_schemas', 'warm_words']),
        }),
      ).toEqual({ [key]: JSON.stringify(['portrait', 'warm_words']) });
      // Все элементы невалидны — фильтруется в пустой массив, ключ не
      // отбрасывается (это не то же самое, что «отсутствие ключа» — сервер
      // честно хранит «пользователь остался без кастомного порядка»).
      expect(sanitizeUiPrefs({ [key]: JSON.stringify(['nope']) })).toEqual({
        [key]: '[]',
      });
      // Длина считается ДО фильтрации — не способ обойти лимит охапкой мусора.
      expect(
        sanitizeUiPrefs({
          [key]: JSON.stringify(Array.from({ length: 17 }, () => 'streak')),
        }),
      ).toEqual({});
      // Структурно невалидное (не массив/не строки) — по-прежнему весь ключ.
      expect(sanitizeUiPrefs({ [key]: 'not-json' })).toEqual({});
      expect(sanitizeUiPrefs({ [key]: JSON.stringify({ a: 1 }) })).toEqual({});
      expect(sanitizeUiPrefs({ [key]: JSON.stringify(['streak', 5]) })).toEqual(
        {},
      );
    }
  });

  it('screen_order_today: валидный массив из блоков «Сегодня» проходит, не-массив/чужой id отбрасывается', () => {
    const order = JSON.stringify([
      'focus',
      'streak',
      'phrase',
      'secondary',
      'therapist_banner',
    ]);
    expect(sanitizeUiPrefs({ screen_order_today: order })).toEqual({
      screen_order_today: order,
    });
    expect(
      sanitizeUiPrefs({ screen_order_today: JSON.stringify(['мусор']) }),
    ).toEqual({ screen_order_today: '[]' });
    expect(
      sanitizeUiPrefs({ screen_order_today: JSON.stringify({ a: 1 }) }),
    ).toEqual({});
    expect(sanitizeUiPrefs({ screen_order_today: 'not-json' })).toEqual({});
  });

  it('значение длиннее 2000 символов отбрасывается', () => {
    const huge = JSON.stringify(['tracker']).padEnd(2001, ' ');
    expect(sanitizeUiPrefs({ quick_actions_hidden_plus: huge })).toEqual({});
  });

  it('невалидное значение по одному ключу не мешает валидным соседям', () => {
    expect(
      sanitizeUiPrefs({
        today_focus_practice: 'garbage',
        today_streak_hidden: '1',
        screen_hidden_profile: JSON.stringify(['heatmap']),
      }),
    ).toEqual({
      today_streak_hidden: '1',
      screen_hidden_profile: JSON.stringify(['heatmap']),
    });
  });

  it('несколько валидных ключей одновременно проходят целиком', () => {
    const input = {
      today_focus_practice: 'gratitude',
      today_streak_hidden: '0',
      quick_actions_order_plus: JSON.stringify(['tracker', 'stop']),
      screen_hidden_patterns: JSON.stringify(['insights', 'heroes']),
    };
    expect(sanitizeUiPrefs(input)).toEqual(input);
  });
});
