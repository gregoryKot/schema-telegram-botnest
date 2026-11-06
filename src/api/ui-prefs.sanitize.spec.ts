// Юнит-тест чистой функции sanitizeUiPrefs (без Nest-обвязки) — серверное
// зеркало кастомизации экранов (User.uiPrefs). Санитизация «всё или
// ничего» ПО КЛЮЧУ: невалидное значение отбрасывает только свой ключ, не
// весь объект.
import { sanitizeUiPrefs, SYNCED_PREF_KEYS } from './ui-prefs.sanitize';

describe('sanitizeUiPrefs', () => {
  it('реестр ключей — 7 штук, ровно как в зафиксированном контракте', () => {
    expect(SYNCED_PREF_KEYS).toEqual([
      'quick_actions_hidden_tools',
      'quick_actions_order_tools',
      'screen_hidden_profile',
      'screen_hidden_patterns',
      'screen_order_profile',
      'screen_order_patterns',
      'why_seen_v1',
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
        why_seen_v1: '1',
        evil_key: 'x',
        __proto__: 'ignored',
      }),
    ).toEqual({ why_seen_v1: '1' });
  });

  it('ключи бывшей главной мини-аппа (устройство ещё шлёт старое) отбрасываются', () => {
    expect(
      sanitizeUiPrefs({
        today_focus_practice: 'tracker',
        today_streak_hidden: '1',
        today_phrase_hidden: '1',
        today_secondary_hidden: '1',
        today_therapist_banner_hidden: '1',
        screen_order_today: JSON.stringify(['streak']),
        quick_actions_hidden_plus: JSON.stringify(['tracker']),
        quick_actions_order_plus: JSON.stringify(['tracker']),
      }),
    ).toEqual({});
  });

  it('quick_actions_hidden_tools/order_tools: JSON-массив id ⊆ QUICK_ACTION_IDS, длина ≤ 32', () => {
    for (const key of [
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

  it('значение длиннее 2000 символов отбрасывается', () => {
    const huge = JSON.stringify(['tracker']).padEnd(2001, ' ');
    expect(sanitizeUiPrefs({ quick_actions_hidden_tools: huge })).toEqual({});
  });

  it('невалидное значение по одному ключу не мешает валидным соседям', () => {
    expect(
      sanitizeUiPrefs({
        why_seen_v1: 'garbage',
        quick_actions_order_tools: JSON.stringify(['tracker']),
        screen_hidden_profile: JSON.stringify(['heatmap']),
      }),
    ).toEqual({
      quick_actions_order_tools: JSON.stringify(['tracker']),
      screen_hidden_profile: JSON.stringify(['heatmap']),
    });
  });

  it('несколько валидных ключей одновременно проходят целиком', () => {
    const input = {
      why_seen_v1: '0',
      quick_actions_order_tools: JSON.stringify(['tracker', 'stop']),
      screen_hidden_patterns: JSON.stringify(['insights', 'heroes']),
    };
    expect(sanitizeUiPrefs(input)).toEqual(input);
  });

  it('why_seen_v1: только 1/0 (флаг «объяснение показано»)', () => {
    expect(sanitizeUiPrefs({ why_seen_v1: '1' })).toEqual({ why_seen_v1: '1' });
    expect(sanitizeUiPrefs({ why_seen_v1: 'yes' })).toEqual({});
  });
});
