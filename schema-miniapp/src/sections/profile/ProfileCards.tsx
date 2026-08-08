// Скрываемые карточки профиля: каждая обёрнута isHidden + holdProps хука
// useScreenBlocks (правило «одна механика — один компонент») — долгое
// нажатие на карточку открывает лист «Настроить экран» с подсветкой именно
// этой строки. Вынесено из ProfileSection — файл в бейслайне ratchet
// (правило №10 CLAUDE.md), новой логике было некуда поместиться без выноса.
import type { Achievement } from '../../api';
import type { LongPressProps } from '../../hooks/useLongPress';
import type { ScreenBlockId } from '../../utils/screenBlocks';
import { StreakData, InsightsData } from './types';
import { StreakCard } from './StreakCard';
import { ActivityHeatmap } from './ActivityHeatmap';
import { AchievementsCard } from './AchievementsCard';
import { InsightsCard } from './InsightsCard';
import { JourneyEntryCard } from './JourneyEntryCard';

interface BlockVisibility {
  isHidden: (id: ScreenBlockId) => boolean;
  holdProps: (id: ScreenBlockId) => LongPressProps;
}

interface Props {
  ready: boolean;
  blocks: BlockVisibility;
  streak: StreakData | null;
  achievements: Achievement[] | null;
  insights: InsightsData | null;
  hasInsights: boolean | null | undefined;
  activeDates: Set<string>;
  onOpenJourney: () => void;
  onOpenTracker?: () => void;
  onShowAchievements: () => void;
  onShowBestDayInfo: () => void;
}

export function ProfileCards({
  ready,
  blocks,
  streak,
  achievements,
  insights,
  hasInsights,
  activeDates,
  onOpenJourney,
  onOpenTracker,
  onShowAchievements,
  onShowBestDayInfo,
}: Props) {
  const { isHidden, holdProps } = blocks;
  return (
    <>
      {ready && !isHidden('journey') && (
        <div {...holdProps('journey')}>
          <JourneyEntryCard onOpen={onOpenJourney} />
        </div>
      )}

      {ready && streak !== null && !isHidden('streak') && (
        <div {...holdProps('streak')}>
          <StreakCard
            currentStreak={streak.currentStreak}
            longestStreak={streak.longestStreak}
            totalDays={streak.totalDays}
            todayDone={streak.todayDone}
            weekDots={streak.weekDots}
            onOpenTracker={onOpenTracker}
          />
        </div>
      )}

      {ready && activeDates.size > 0 && !isHidden('heatmap') && (
        <div {...holdProps('heatmap')}>
          <ActivityHeatmap
            activeDates={activeDates}
            totalDays={streak?.totalDays ?? 0}
          />
        </div>
      )}

      {ready && achievements && !isHidden('achievements') && (
        <div {...holdProps('achievements')}>
          <AchievementsCard
            achievements={achievements}
            onOpen={onShowAchievements}
          />
        </div>
      )}

      {ready && hasInsights && insights && !isHidden('insights') && (
        <div {...holdProps('insights')}>
          <InsightsCard
            insights={insights}
            onShowBestDayInfo={onShowBestDayInfo}
          />
        </div>
      )}
    </>
  );
}
