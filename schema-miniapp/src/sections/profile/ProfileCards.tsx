// Скрываемые+переставляемые карточки профиля: каждая обёрнута isHidden +
// holdProps хука useScreenBlocks (правило «одна механика — компонент»),
// рендерятся в blocks.orderedIds — долгое нажатие открывает лист «Настроить
// экран» с подсветкой строки. Вынесено из ProfileSection — файл в бейслайне
// ratchet (правило №10 CLAUDE.md), новой логике было некуда без выноса.
//
// Прогрессивный рендер (замер 2026-08-22): раньше все карточки прятались за
// одним общим `ready`, и самый долгий из четырёх запросов держал пустым
// весь экран. Теперь у каждой карточки своя проверка готовности — она
// показывает СВОЙ скелетон (ProfileCardSkeletons.tsx), пока её данные летят,
// не дожидаясь соседей. «Мой путь» вообще без данных — рендерится сразу.
import { Fragment, type ReactNode } from 'react';
import type { Achievement } from '../../api';
import type { ScreenBlockId } from '../../utils/screenBlocks';
import type { BlockVisibility } from '../schemas/blockVisibility';
import { StreakData, InsightsData } from './types';
import type { AboutMeState } from './useAboutMe';
import { StreakCard } from './StreakCard';
import { HeatmapCard } from './HeatmapCard';
import { AchievementsCard } from './AchievementsCard';
import { InsightsCard } from './InsightsCard';
import { JourneyEntryCard } from './JourneyEntryCard';
import { PortraitCard } from './PortraitCard';
import { WarmWordsCard } from './WarmWordsCard';
import {
  PortraitCardSkeleton,
  WarmWordsCardSkeleton,
  StreakCardSkeleton,
  AchievementsCardSkeleton,
  InsightsCardSkeleton,
} from './ProfileCardSkeletons';

interface Props {
  blocks: BlockVisibility;
  streak: StreakData | null;
  streakReady: boolean;
  achievements: Achievement[] | null;
  achievementsReady: boolean;
  insights: InsightsData | null;
  insightsReady: boolean;
  hasInsights: boolean | null | undefined;
  aboutMe: AboutMeState;
  onOpenJourney: () => void;
  onOpenTracker?: () => void;
  onShowAchievements: () => void;
  onShowBestDayInfo: () => void;
  onOpenPatterns: (tab: 'schemas' | 'modes') => void;
  onOpenPortrait: () => void;
}

export function ProfileCards({
  blocks,
  streak,
  streakReady,
  achievements,
  achievementsReady,
  insights,
  insightsReady,
  hasInsights,
  aboutMe,
  onOpenJourney,
  onOpenTracker,
  onShowAchievements,
  onShowBestDayInfo,
  onOpenPatterns,
  onOpenPortrait,
}: Props) {
  const { isHidden, holdProps, orderedIds } = blocks;
  const cardsById: Partial<Record<ScreenBlockId, ReactNode>> = {
    portrait: !isHidden('portrait') && (
      <div {...holdProps('portrait')}>
        {aboutMe.ready ? (
          <PortraitCard
            portrait={aboutMe.portrait}
            ysqCompletedAt={aboutMe.ysqCompletedAt}
            onOpenPatterns={() => onOpenPatterns('schemas')}
            onOpenSheet={onOpenPortrait}
          />
        ) : (
          <PortraitCardSkeleton />
        )}
      </div>
    ),
    warm_words: !isHidden('warm_words') && (
      <div {...holdProps('warm_words')}>
        {aboutMe.ready ? (
          <WarmWordsCard items={aboutMe.warmWordsItems} />
        ) : (
          <WarmWordsCardSkeleton />
        )}
      </div>
    ),
    // Без своих данных — открывает архив, ничего не грузит, рендерится
    // сразу (было гейтено общим `ready` без причины).
    journey: !isHidden('journey') && (
      <div {...holdProps('journey')}>
        <JourneyEntryCard onOpen={onOpenJourney} />
      </div>
    ),
    streak: !isHidden('streak') && (
      <div {...holdProps('streak')}>
        {!streakReady ? (
          <StreakCardSkeleton />
        ) : (
          streak !== null && (
            <StreakCard
              currentStreak={streak.currentStreak}
              longestStreak={streak.longestStreak}
              totalDays={streak.totalDays}
              todayDone={streak.todayDone}
              weekDots={streak.weekDots}
              onOpenTracker={onOpenTracker}
            />
          )
        )}
      </div>
    ),
    // Своя ленивая загрузка (HeatmapCard) — не зависит от streakReady:
    // тяжёлый history(112) не должен ждать даже стрик, только появление
    // карточки во вьюпорте (см. HeatmapCard.tsx).
    heatmap: !isHidden('heatmap') && (
      <div {...holdProps('heatmap')}>
        <HeatmapCard totalDays={streak?.totalDays ?? 0} />
      </div>
    ),
    achievements: !isHidden('achievements') && (
      <div {...holdProps('achievements')}>
        {!achievementsReady ? (
          <AchievementsCardSkeleton />
        ) : (
          achievements !== null && (
            <AchievementsCard
              achievements={achievements}
              onOpen={onShowAchievements}
            />
          )
        )}
      </div>
    ),
    insights: !isHidden('insights') && (
      <div {...holdProps('insights')}>
        {!insightsReady ? (
          <InsightsCardSkeleton />
        ) : (
          hasInsights &&
          insights && (
            <InsightsCard
              insights={insights}
              onShowBestDayInfo={onShowBestDayInfo}
            />
          )
        )}
      </div>
    ),
  };
  return orderedIds.map((id) => <Fragment key={id}>{cardsById[id]}</Fragment>);
}
