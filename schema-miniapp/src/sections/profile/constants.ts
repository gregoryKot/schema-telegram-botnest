export const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export const NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Границы',
};

export type AchievementMeta = { emoji: string; title: string; desc: string };

export const ACHIEVEMENT_META: Record<string, AchievementMeta> = {
  first_day: {
    emoji: '🌱',
    title: 'Первый шаг',
    desc: 'Заполнил дневник первый раз',
  },
  streak_3: { emoji: '🔥', title: 'Начало серии', desc: '3 дня подряд' },
  streak_7: { emoji: '⭐', title: 'Неделя', desc: '7 дней подряд' },
  streak_14: { emoji: '💫', title: 'Две недели', desc: '14 дней подряд' },
  streak_30: { emoji: '🏆', title: 'Месяц', desc: '30 дней подряд' },
  streak_100: { emoji: '👑', title: 'Сотня', desc: '100 дней подряд' },
  total_10: { emoji: '📅', title: '10 дней', desc: '10 дней всего' },
  total_50: { emoji: '📆', title: '50 дней', desc: '50 дней всего' },
  high_day: {
    emoji: '✨',
    title: 'Хороший день',
    desc: 'Средний индекс выше 8',
  },
  all_above7: {
    emoji: '🎯',
    title: 'Баланс',
    desc: 'Все потребности выше 7 в один день',
  },
  comeback: {
    emoji: '🔄',
    title: 'Возвращение',
    desc: 'Вернулся после перерыва в 3+ дня',
  },
  growth: {
    emoji: '📈',
    title: 'Рост',
    desc: 'Потребность выросла на 3+ за неделю',
  },
  pair_connected: {
    emoji: '🤝',
    title: 'Партнёр',
    desc: 'Связался с партнёром',
  },
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  todayDone: boolean;
  weekDots: boolean[];
};

export type InsightsData = {
  weeklyStats: Array<{
    needId: string;
    avg: number | null;
    trend: '↑' | '↓' | '→';
  }>;
  bestDayOfWeek: string | null;
  worstDayOfWeek: string | null;
  totalDays: number;
};

export const TODAY_DOW_IDX = (new Date().getDay() + 6) % 7; // 0=пн ... 6=вс
