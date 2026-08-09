// Скрываемые+переставляемые карточки профиля: каждая обёрнута isHidden +
// holdProps хука useScreenBlocks (правило «одна механика — компонент»),
// рендерятся в blocks.orderedIds — долгое нажатие открывает лист «Настроить
// экран» с подсветкой строки. Вынесено из ProfileSection — файл в бейслайне
// ratchet (правило №10 CLAUDE.md), новой логике было некуда без выноса.
import { Fragment, type ReactNode } from 'react';
import type { Achievement } from '../../api';
import type { ScreenBlockId } from '../../utils/screenBlocks';
import type { BlockVisibility } from '../schemas/blockVisibility';
import { StreakData, InsightsData } from './types';
import { StreakCard } from './StreakCard';
import { ActivityHeatmap } from './ActivityHeatmap';
import { AchievementsCard } from './AchievementsCard';
import { InsightsCard } from './InsightsCard';
import { JourneyEntryCard } from './JourneyEntryCard';

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
  const { isHidden, holdProps, orderedIds } = blocks;
  const cardsById: Partial<Record<ScreenBlockId, ReactNode>> = {
    journey: ready && !isHidden('journey') && (
      <div {...holdProps('journey')}>
        <JourneyEntryCard onOpen={onOpenJourney} />
      </div>
    ),
    streak: ready && streak !== null && !isHidden('streak') && (
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
    ),
    heatmap: ready && activeDates.size > 0 && !isHidden('heatmap') && (
      <div {...holdProps('heatmap')}>
        <ActivityHeatmap
          activeDates={activeDates}
          totalDays={streak?.totalDays ?? 0}
        />
      </div>
    ),
    achievements: ready && achievements && !isHidden('achievements') && (
      <div {...holdProps('achievements')}>
        <AchievementsCard
          achievements={achievements}
          onOpen={onShowAchievements}
        />
      </div>
    ),
    insights: ready && hasInsights && insights && !isHidden('insights') && (
      <div {...holdProps('insights')}>
        <InsightsCard
          insights={insights}
          onShowBestDayInfo={onShowBestDayInfo}
        />
      </div>
    ),
  };
  return orderedIds.map((id) => <Fragment key={id}>{cardsById[id]}</Fragment>);
}
