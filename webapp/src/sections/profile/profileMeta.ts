export const NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность', autonomy: 'Автономия',
  expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы',
};

export const ACHIEVEMENT_META: Record<string, { title: string; desc: string }> = {
  first_day:      { title: 'Первый шаг',   desc: 'Первая запись в дневнике' },
  streak_3:       { title: 'Начало серии', desc: '3 дня подряд' },
  streak_7:       { title: 'Неделя',        desc: '7 дней подряд' },
  streak_14:      { title: 'Две недели',    desc: '14 дней подряд' },
  streak_30:      { title: 'Месяц',         desc: '30 дней подряд' },
  streak_100:     { title: 'Сотня',         desc: '100 дней подряд' },
  total_10:       { title: '10 дней',       desc: '10 дней всего' },
  total_50:       { title: '50 дней',       desc: '50 дней всего' },
  high_day:       { title: 'Хороший день',  desc: 'Средний индекс выше 8' },
  all_above7:     { title: 'Баланс',        desc: 'Все потребности выше 7 в один день' },
  comeback:       { title: 'Возвращение',   desc: 'Возвращение после перерыва в 3+ дня' },
  growth:         { title: 'Рост',          desc: 'Потребность выросла на 3+ за неделю' },
  pair_connected: { title: 'Партнёр',       desc: 'Связь с партнёром' },
};

export type StreakData = { currentStreak: number; longestStreak: number; totalDays: number; todayDone: boolean; weekDots: boolean[] };
export type InsightsData = { weeklyStats: Array<{ needId: string; avg: number | null; trend: '↑' | '↓' | '→' }>; bestDayOfWeek: string | null; worstDayOfWeek: string | null; totalDays: number };

/** Hue акцента для тепловой карты и плиток достижений. */
export const PROFILE_HUE = 28;
