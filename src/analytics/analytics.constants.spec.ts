// Реестры-allow-list продуктовой аналитики (правило №4/№8 CLAUDE.md): каждый
// массив здесь — источник правды, по которому DTO валидирует meta и /stats
// считает метрики. Дубль id или пустая строка в этих списках не упадёт при
// импорте (TS видит только тип строки) — упадёт только рантайм-проверка типа
// `ANALYTICS_EVENTS.includes(name)`, и упадёт молча (событие просто исчезнет
// из БД, см. AnalyticsService.track). Сверку фронт↔бэк держит отдельный
// трипваер (src/security/analytics-sync.invariants.spec.ts) — здесь
// проверяется внутренняя целостность самих реестров.
import {
  ANALYTICS_EVENTS,
  PUBLIC_ANALYTICS_EVENTS,
  QUIZ_EVENT_SOURCES,
  PRACTICE_LINK_PLACES,
  TODAY_BLOCKS,
  CUSTOMIZE_ENTRY_POINTS,
  HOME_SCREEN_ACTIONS,
  HOME_SCREEN_SURFACES,
  SITE_INSTALL_SURFACES,
  ONBOARDING_STEPS,
  SHARE_CARD_KINDS,
  CRISIS_SURFACES,
  TODAY_FOCUS_PRACTICES,
  WEB_BANNER_IDS,
  SIGNUP_SOURCES,
  PROFILE_PATTERN_KINDS,
} from './analytics.constants';
import { CRISIS_SURFACES as CRISIS_SURFACES_DIRECT } from './crisis-surfaces.constants';
import { SIGNUP_SOURCES as SIGNUP_SOURCES_DIRECT } from './signup-sources.constants';

/** Все перечислимые реестры events/enum'ов этого модуля — сверяются одинаково. */
const REGISTRIES: Record<string, readonly string[]> = {
  ANALYTICS_EVENTS,
  PUBLIC_ANALYTICS_EVENTS,
  QUIZ_EVENT_SOURCES,
  PRACTICE_LINK_PLACES,
  TODAY_BLOCKS,
  CUSTOMIZE_ENTRY_POINTS,
  HOME_SCREEN_ACTIONS,
  HOME_SCREEN_SURFACES,
  SITE_INSTALL_SURFACES,
  ONBOARDING_STEPS,
  SHARE_CARD_KINDS,
  CRISIS_SURFACES,
  TODAY_FOCUS_PRACTICES,
  WEB_BANNER_IDS,
  SIGNUP_SOURCES,
  PROFILE_PATTERN_KINDS,
};

describe('реестры analytics.constants: без дублей и пустых значений', () => {
  it.each(Object.entries(REGISTRIES))('%s: непусто', (_name, values) => {
    expect(values.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(REGISTRIES))('%s: id уникальны', (_name, values) => {
    // Дубль в allow-list — не ошибка типов (строка есть строка), но два
    // разных смысла срослись бы в один при санитизации meta / отчёте /stats.
    expect(new Set(values).size).toBe(values.length);
  });

  it.each(Object.entries(REGISTRIES))(
    '%s: ни одного пустого/пробельного значения',
    (_name, values) => {
      for (const v of values) expect(v.trim()).not.toBe('');
    },
  );

  it.each(Object.entries(REGISTRIES))(
    '%s: значения — снейк_кейс из латиницы/цифр (безопасны для callback_data/meta)',
    (_name, values) => {
      for (const v of values) expect(v).toMatch(/^[a-z][a-z0-9_]*$/);
    },
  );
});

describe('PUBLIC_ANALYTICS_EVENTS ⊆ ANALYTICS_EVENTS', () => {
  it('каждое публичное (анонимное) событие есть в общем allow-list', () => {
    // Иначе AnalyticsService.track молча дропнет «публичное» событие: DTO его
    // пропустит (PUBLIC_ANALYTICS_EVENTS разрешает без авторизации), а сервис
    // отбросит по ANALYTICS_EVENTS.includes(name) — метрика тихо пропадёт.
    for (const name of PUBLIC_ANALYTICS_EVENTS) {
      expect(ANALYTICS_EVENTS).toContain(name);
    }
  });
});

describe('SITE_INSTALL_SURFACES ⊆ HOME_SCREEN_SURFACES', () => {
  it('каждая сайтовая surface установки есть в общем реестре поверхностей', () => {
    // Иначе фильтр воронки мини-аппа (bot.product-metrics.service.ts) и блок
    // «Установка с сайта» (site-install-metrics.service.ts) молча разъедутся
    // с DTO-валидацией surface (правило №4: дублированные реестры — только
    // с тестом-сверкой).
    for (const surface of SITE_INSTALL_SURFACES) {
      expect(HOME_SCREEN_SURFACES).toContain(surface);
    }
  });
});

describe('CRISIS_SURFACES реэкспортирован без искажений', () => {
  it('analytics.constants.ts отдаёт тот же массив, что и crisis-surfaces.constants.ts', () => {
    // Правило №10: CRISIS_SURFACES вынесен в отдельный файл ради лимита строк
    // — реэкспорт легко может «протухнуть» (забыть обновить при рефакторинге
    // импортов), тест ловит расхождение.
    expect(CRISIS_SURFACES).toEqual(CRISIS_SURFACES_DIRECT);
  });
});

describe('SIGNUP_SOURCES реэкспортирован без искажений', () => {
  it('analytics.constants.ts отдаёт тот же массив, что и signup-sources.constants.ts', () => {
    expect(SIGNUP_SOURCES).toEqual(SIGNUP_SOURCES_DIRECT);
  });

  it('содержит other — обязательный фолбэк для неизвестного/мусорного slug', () => {
    expect(SIGNUP_SOURCES).toContain('other');
  });
});
