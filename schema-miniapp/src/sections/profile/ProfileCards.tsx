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
import type { AboutMeState } from './useAboutMe';
import { StreakCard } from './StreakCard';
import { ActivityHeatmap } from './ActivityHeatmap';
import { AchievementsCard } from './AchievementsCard';
import { InsightsCard } from './InsightsCard';
import { JourneyEntryCard } from './JourneyEntryCard';
import { PortraitCard } from './PortraitCard';
import { MyPatternsCard } from './MyPatternsCard';
import { WarmWordsCard } from './WarmWordsCard';

interface Props {
  ready: boolean;
  blocks: BlockVisibility;
  streak: StreakData | null;
  achievements: Achievement[] | null;
  insights: InsightsData | null;
  hasInsights: boolean | null | undefined;
  activeDates: Set<string>;
  aboutMe: AboutMeState;
  onOpenJourney: () => void;
  onOpenTracker?: () => void;
  onShowAchievements: () => void;
  onShowBestDayInfo: () => void;
  onOpenPatterns: (tab: 'schemas' | 'modes') => void;
}

export function ProfileCards({
  ready,
  blocks,
  streak,
  achievements,
  insights,
  hasInsights,
  activeDates,
  aboutMe,
  onOpenJourney,
  onOpenTracker,
  onShowAchievements,
  onShowBestDayInfo,
  onOpenPatterns,
}: Props) {
  const { isHidden, holdProps, orderedIds } = blocks;
  const cardsById: Partial<Record<ScreenBlockId, ReactNode>> = {
    portrait: aboutMe.ready && !isHidden('portrait') && (
      <div {...holdProps('portrait')}>
        <PortraitCard
          portrait={aboutMe.portrait}
          ysqCompletedAt={aboutMe.ysqCompletedAt}
          onOpenPatterns={() => onOpenPatterns('schemas')}
        />
      </div>
    ),
    my_schemas: aboutMe.ready && !isHidden('my_schemas') && (
      <div {...holdProps('my_schemas')}>
        <MyPatternsCard
          kind="schema"
          ids={aboutMe.mySchemaIds}
          weekFreq={aboutMe.schemaWeekFreq}
          schemaEntries={aboutMe.schemaEntries}
          setSchemaEntries={aboutMe.setSchemaEntries}
          onOpenPatterns={onOpenPatterns}
        />
      </div>
    ),
    my_modes: aboutMe.ready && !isHidden('my_modes') && (
      <div {...holdProps('my_modes')}>
        <MyPatternsCard
          kind="mode"
          ids={aboutMe.myModeIds}
          weekFreq={aboutMe.modeWeekFreq}
          modeEntries={aboutMe.modeEntries}
          setModeEntries={aboutMe.setModeEntries}
          onOpenPatterns={onOpenPatterns}
        />
      </div>
    ),
    warm_words: aboutMe.ready && !isHidden('warm_words') && (
      <div {...holdProps('warm_words')}>
        <WarmWordsCard />
      </div>
    ),
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
