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
