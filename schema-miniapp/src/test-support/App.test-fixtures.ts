// Моки модулей верхнего уровня для тестов App.tsx — вынесены из
// App.test-helpers.tsx, чтобы уложиться в потолок 300 строк на новый файл
// (правило №10 CLAUDE.md). Импортируется ПЕРЕД `import App from '../App'`
// в App.test-helpers.tsx — vi.mock хойстится внутри ЭТОГО файла и полностью
// отрабатывает раньше, чем helpers дойдёт до статического импорта App.tsx.
import { vi } from 'vitest';
import type { UserFlags } from '../useUserFlags';
import type { UserSettings } from '../api';
import type { UserProfile } from '../../../shared/src/types';

vi.mock('../session', () => ({
  ensureSession: vi.fn().mockResolvedValue(true),
  SESSION_EXPIRED_EVENT: 'session-expired',
  SESSION_EXPIRED_ERROR: 'Не удалось получить доступ (401)',
  renewSession: vi.fn().mockResolvedValue(true),
  adoptSession: vi.fn(),
  clearSession: vi.fn(),
  markSessionExpired: vi.fn(),
  authHeaders: vi.fn(() => ({})),
}));

const DEFAULT_FLAGS: UserFlags = {
  themePref: null,
  onboardingV1Done: false,
  onboardingV2Done: true,
  onboardingSkipped: [],
  childhoodWheelDone: false,
  ysqBannerDismissed: false,
  hintSheetCloseShown: false,
  hintHistoryDismissed: false,
  trackerOnboardingDone: false,
  lastCelebrationDate: null,
  lastYesterdayBannerDate: null,
  lastWeeklyQuestionWeek: null,
  schemaIntrosShown: [],
  modeIntrosShown: [],
  therapistMode: false,
  defaultSection: null,
};

/** Возврат useUserFlags() с точечными переопределениями — общий билдер вместо
 *  копии литерала в каждом test-файле (правило №11: повтор — в модуль). */
/** Флаги успешно прочитаны с сервера — обычное состояние в тестах.
 *  Случай «прочитать не удалось» моделируется unreadableFlags(). */
export function defaultFlags(overrides: Partial<UserFlags> = {}) {
  return {
    flags: { ...DEFAULT_FLAGS, ...overrides },
    loaded: true,
    loadedFromServer: true,
  };
}

/** Запрос флагов завершился, но ответа сервера нет (401/сеть): значения —
 *  дефолтные, и выдавать их за настройки пользователя нельзя. */
export function unreadableFlags() {
  return { flags: { ...DEFAULT_FLAGS }, loaded: true, loadedFromServer: false };
}

export const mockUseUserFlags = vi.fn(() => defaultFlags());

vi.mock('../useUserFlags', () => ({
  useUserFlags: () => mockUseUserFlags(),
  setFlag: vi.fn().mockResolvedValue(undefined),
}));

/** Билдер профиля с переопределениями — общий вместо копии литерала в каждом
 *  тесте роли/реконсиляции (правило №11). */
export function mockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    role: 'CLIENT',
    name: null,
    ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: {
      enabled: false,
      reminderEnabled: false,
      timezone: 'Europe/Moscow',
      localHour: 21,
    },
    streak: 0,
    lastActivity: {
      needsTracker: null,
      schemaDiary: null,
      modeDiary: null,
      gratitudeDiary: null,
    },
    mySchemaIds: [],
    myModeIds: [],
    ...overrides,
  };
}

/** Билдер settings с переопределениями — та же причина, что и mockProfile. */
export function mockSettings(
  overrides: Partial<UserSettings> = {},
): UserSettings {
  return {
    notifyEnabled: false,
    notifyLocalHour: 21,
    notifyTimezone: 'Europe/Moscow',
    notifyReminderEnabled: false,
    addressForm: 'ty',
    pairCardDismissed: false,
    mySchemaIds: [],
    myModeIds: [],
    therapistShareCards: false,
    therapistShareProfile: false,
    ...overrides,
  };
}

// Дефолтные резолвы api — покрывают все вызовы из начального эффекта App.tsx
// (+ useOnboardingGate.getDisclaimer/acceptDisclaimer, useHostBackButton.getPair),
// чтобы неотмоканный тест не падал на `.then` от undefined. Переопределяется
// через `mockResolvedValueOnce` в конкретных тестах.
vi.mock('../api', () => ({
  api: {
    init: vi.fn().mockResolvedValue(undefined),
    recordActivity: vi.fn().mockResolvedValue(undefined),
    flushOutbox: vi.fn().mockResolvedValue(undefined),
    getPractices: vi.fn().mockResolvedValue([]),
    getPlanHistory: vi.fn().mockResolvedValue([]),
    needs: vi.fn().mockResolvedValue([]),
    ratings: vi.fn().mockResolvedValue({}),
    getPair: vi.fn().mockResolvedValue({ partners: [], pendingCode: null }),
    getSettings: vi.fn().mockResolvedValue({
      notifyEnabled: false,
      notifyLocalHour: 21,
      notifyTimezone: 'Europe/Moscow',
      notifyReminderEnabled: false,
      addressForm: 'ty',
      pairCardDismissed: false,
      mySchemaIds: [],
      myModeIds: [],
      therapistShareCards: false,
      therapistShareProfile: false,
    }),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    getPendingPlans: vi.fn().mockResolvedValue([]),
    getChildhoodRatings: vi.fn().mockResolvedValue({}),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getProfile: vi.fn().mockResolvedValue({
      role: 'CLIENT',
      name: null,
      ysq: { completedAt: null, activeSchemaIds: [] },
      notifications: {
        enabled: false,
        reminderEnabled: false,
        timezone: 'Europe/Moscow',
        localHour: 21,
      },
      streak: 0,
      lastActivity: {
        needsTracker: null,
        schemaDiary: null,
        modeDiary: null,
        gratitudeDiary: null,
      },
      mySchemaIds: [],
      myModeIds: [],
    }),
    getTherapyRelation: vi.fn().mockResolvedValue(null),
    getTasks: vi.fn().mockResolvedValue([]),
    joinPair: vi.fn().mockResolvedValue(undefined),
    joinTherapy: vi.fn().mockResolvedValue(undefined),
    setTherapistView: vi.fn().mockResolvedValue({ ok: true }),
    resignTherapist: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue([]),
    getDisclaimer: vi.fn().mockResolvedValue({ accepted: true }),
    acceptDisclaimer: vi.fn().mockResolvedValue(undefined),
  },
  // Экран ошибки сам отправляет отчёт о сломанном входе (инцидент
  // 2026-08-08) — без этого мока рендер ошибки падает на несуществующем
  // экспорте, и «видимая ошибка вместо молчания» перестаёт проверяться.
  reportClientError: vi.fn(),
}));
