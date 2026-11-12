// Таблица значков ACHIEVEMENT_LOOK (shared/src/theme/entityLookMaps.ts) литералами для профиля:
// рантайм-импорт entityLook и entityLookMaps из значка (AchievementBadge в диалоге достижений) перекраивал
// чанки — ExScreen выезжал из главного чанка, его CSS вставал раньше index.css (check-css-link-order),
// бандл рос на 20–25 КБ (b21). Серии и «дни всего» — одним видом на группу: знак тот же, плотность —
// на экране. Сверка с shared — achievementBadgeLook.test.ts (правило №4).
import type { Look } from '../../../../shared/src/theme/entityLook';

const SERIES: Look = { hue: 70, sign: 'strokes' };
const DAYS: Look = { hue: 240, sign: 'sheets' };
const group = (ids: string[], look: Look) => Object.fromEntries(ids.map((id) => [id, look]));

export const ACHIEVEMENT_LOOK_LIT: Readonly<Record<string, Look>> = {
  first_day: { hue: 45, sign: 'pebbles' },
  ...group(['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_100'], SERIES),
  ...group(['total_10', 'total_50'], DAYS),
  high_day: { hue: 195, sign: 'leaf' },
  all_above7: { hue: 45, sign: 'wheel' },
  comeback: { hue: 70, sign: 'child_care' },
  growth: { hue: 70, sign: 'need_autonomy' },
  pair_connected: { hue: 28, sign: 'need_attachment' },
};

/** Вид значка достижения; незнакомое — null (без выдуманного знака). */
export const badgeLook = (id: string): Look | null =>
  Object.hasOwn(ACHIEVEMENT_LOOK_LIT, id) ? ACHIEVEMENT_LOOK_LIT[id] : null;
