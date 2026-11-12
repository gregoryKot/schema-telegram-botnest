// Таблица значков ACHIEVEMENT_LOOK (shared/src/theme/entityLookMaps.ts) литералами для профиля:
// рантайм-импорт entityLook из значка (AchievementBadge в диалоге достижений) перекраивал чанки —
// ExScreen выезжал из главного чанка, его CSS вставал раньше index.css (check-css-link-order), бандл
// рос на 25 КБ (b21). Сверка с shared — achievementBadgeLook.test.ts (правило №4).
import type { Look } from '../../../../shared/src/theme/entityLook';

const LOOK: Readonly<Record<string, Look>> = {
  first_day: { hue: 45, sign: 'pebbles' },
  streak_3: { hue: 70, sign: 'strokes' }, streak_7: { hue: 70, sign: 'strokes' }, streak_14: { hue: 70, sign: 'strokes' },
  streak_30: { hue: 70, sign: 'strokes' }, streak_100: { hue: 70, sign: 'strokes' },
  total_10: { hue: 240, sign: 'sheets' }, total_50: { hue: 240, sign: 'sheets' },
  high_day: { hue: 195, sign: 'leaf' }, all_above7: { hue: 45, sign: 'wheel' },
  comeback: { hue: 70, sign: 'child_care' }, growth: { hue: 70, sign: 'need_autonomy' },
  pair_connected: { hue: 28, sign: 'need_attachment' },
};

export const ACHIEVEMENT_LOOK_LIT = LOOK;

/** Вид значка достижения; незнакомое — null (без выдуманного знака). */
export const badgeLook = (id: string): Look | null => (Object.hasOwn(LOOK, id) ? LOOK[id] : null);
