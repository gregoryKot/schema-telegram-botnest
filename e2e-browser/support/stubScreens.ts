// Ручки экранов «Профиль» и «Паттерны» для браузерного смока — ответы
// настоящих контроллеров клиенту без данных (как остальные фикстуры,
// stubFixtures.ts). Без них «Профиль» в смоке падал в баннер «Не удалось
// загрузить часть данных» и в отчёт о сбое (getYsqHistory failed), а
// «Паттерны» — в «mode-map count load failed»: экраны с «Настроить экран»
// нельзя было открыть в браузере вовсе (#922). Форму сверяет с сервером
// test/browser-stub-contract.e2e-spec.ts (через FIXTURES).

// NEED_IDS (src/bot/bot.service.ts) — те же id, что у STUB_NEEDS; не импортом из
// stubFixtures.ts: тот сам импортирует этот файл, и цикл отдал бы undefined.
const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

// InsightMetrics.getAchievements (src/bot/bot.insight-metrics.ts) + значок пары
// (tracker.controller.ts getAchievements): ни один не заработан.
const ACHIEVEMENT_IDS = [
  'first_day',
  'streak_3',
  'streak_7',
  'streak_14',
  'streak_30',
  'streak_100',
  'total_10',
  'total_50',
  'high_day',
  'all_above7',
  'comeback',
  'growth',
  'pair_connected',
];

export const SCREEN_FIXTURES: Record<string, unknown> = {
  'GET /api/achievements': ACHIEVEMENT_IDS.map((id) => ({ id, earned: false })),
  // tracker.controller.ts getInsights: по строке на потребность (NEED_IDS),
  // оценок за две недели нет — avg null, тренд «→»; дней недели меньше трёх.
  'GET /api/insights': {
    weeklyStats: NEED_IDS.map((needId) => ({ needId, avg: null, trend: '→' })),
    bestDayOfWeek: null,
    worstDayOfWeek: null,
    totalDays: 0,
  },
  'GET /api/ysq-history': [], // ysq.controller.ts: пройденных тестов нет
  'GET /api/therapy/my-mode-maps': [], // mode-maps.controller.ts: карт от терапевта нет
};
