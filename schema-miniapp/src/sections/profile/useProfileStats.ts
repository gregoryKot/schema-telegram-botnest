// Стрик/ачивки/инсайты вкладки «Я» — раньше единый Promise.all в
// ProfileSection держал ВСЕ три карточки пустыми до самого долгого ответа
// (замер 2026-08-22, профиль 3G+CPU×4: контент появлялся только через
// 1321мс). Теперь у каждого источника свой ready — карточка показывается,
// как только пришли именно её данные, а не данные соседки. history(112) для
// тепловой карты сюда не входит вовсе — она тяжелее всех трёх вместе взятых
// и грузится лениво, см. HeatmapCard.tsx.
import { useEffect, useState } from 'react';
import { api, Achievement } from '../../api';
import { StreakData, InsightsData } from './types';

export function useProfileStats(refreshKey?: number) {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [streakReady, setStreakReady] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [achievementsReady, setAchievementsReady] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsReady, setInsightsReady] = useState(false);

  useEffect(() => {
    // Раньше streak/achievements/insights обнулялись перед рефетчем — провал
    // повторного запроса подменял реальный стрик показанным «0» (regression,
    // тест в ProfileSection.test.tsx). Обнуляем только ready, не данные.
    setStreakReady(false);
    setAchievementsReady(false);
    setInsightsReady(false);

    // Три независимых цепочки, а не Promise.all с одним ready: падение или
    // задержка одного источника больше не держит остальные два в скелетоне.
    void api
      .getStreak()
      .then(setStreak)
      .catch((e) => console.error('getStreak failed', e))
      .finally(() => setStreakReady(true));

    void api
      .getAchievements()
      .then(setAchievements)
      .catch((e) => console.error('getAchievements failed', e))
      .finally(() => setAchievementsReady(true));

    void api
      .getInsights()
      .then(setInsights)
      .catch((e) => console.error('getInsights failed', e))
      .finally(() => setInsightsReady(true));
  }, [refreshKey]);

  const hasInsights =
    insights !== null && insights.weeklyStats.some((s) => s.avg !== null);

  return {
    streak,
    streakReady,
    achievements,
    achievementsReady,
    insights,
    insightsReady,
    hasInsights,
  };
}
