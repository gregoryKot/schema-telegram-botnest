import { Fragment, useState } from 'react';
import { Need } from '../../types';
import { TodayFocusCard } from '../../components/TodayFocusCard';
import { PhraseShareCard } from '../../components/PhraseShareCard';
import { DayShareButton } from '../../share/DayShareButton';
import { useTodayCustomization } from '../../hooks/useTodayCustomization';
import { TODAY_MORE_KEY } from './helpers';
import { SecondaryCards, RecentDiary } from './SecondaryCards';
import { StreakCard } from './StreakCard';
import { TherapistBanner } from './TherapistBanner';

// Band переставляемых блоков «Сегодня»: рендерит блоки в порядке
// today.orderedIds (ключ screen_order_today, generic-механизм экранов).
// Условия видимости у каждого блока свои — порядок их не отменяет.
// Закреплённые вне band живут в TodaySection: виджет обучения — сверху
// (воронка новичка не переставляется), предложение значка — снизу
// (временная системная карточка, уходит сама).
export function TodayBlocks({
  today,
  userRole,
  onOpenTherapistCabinet,
  streak,
  needs,
  ratings,
  yesterdayRatings,
  ratedCount,
  allRated,
  avgScore,
  todayDone,
  diariesLoaded,
  recentDiaries,
  onOpenTracker,
  onNewDiaryEntry,
  onOpenTrackerHistory,
  onOpenTrackerAt,
  onOpenDiaries,
  onSetDiaryTask,
}: {
  today: ReturnType<typeof useTodayCustomization>;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
  streak: number;
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings: Record<string, number>;
  ratedCount: number;
  allRated: boolean;
  avgScore: string | null;
  todayDone: { schema: boolean; mode: boolean; gratitude: boolean };
  diariesLoaded: boolean;
  recentDiaries: RecentDiary[];
  onOpenTracker: () => void;
  onNewDiaryEntry?: (t: 'schema' | 'mode' | 'gratitude') => void;
  onOpenTrackerHistory?: () => void;
  onOpenTrackerAt?: (needId: string) => void;
  onOpenDiaries: () => void;
  onSetDiaryTask: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(
    () => localStorage.getItem(TODAY_MORE_KEY) === '1',
  );

  function toggleMore() {
    setMoreOpen((prev) => {
      const next = !prev;
      if (next) localStorage.setItem(TODAY_MORE_KEY, '1');
      else localStorage.removeItem(TODAY_MORE_KEY);
      return next;
    });
  }

  const blocks: Record<string, () => React.ReactNode> = {
    therapist_banner: () =>
      userRole === 'THERAPIST' &&
      onOpenTherapistCabinet &&
      !today.therapistBannerHidden ? (
        <TherapistBanner onOpen={onOpenTherapistCabinet} />
      ) : null,

    // Стрик-карточка (макет): мягкая, без наказания за пропуск.
    streak: () =>
      !today.streakHidden && streak > 0 ? (
        <div {...today.holdStreak}>
          <StreakCard streak={streak} />
        </div>
      ) : null,

    // Фокус дня: одна главная задача (нейроинклюзивность, волна 1).
    focus: () => (
      <div {...today.holdFocus}>
        <TodayFocusCard
          practice={today.practice}
          ratedCount={ratedCount}
          total={needs.length}
          avgScore={avgScore}
          practiceDoneToday={
            today.practice !== 'tracker' && todayDone[today.practice]
          }
          onAction={() =>
            today.practice === 'tracker'
              ? onOpenTracker()
              : onNewDiaryEntry?.(today.practice)
          }
          onOpenHistory={onOpenTrackerHistory}
          shareSlot={<DayShareButton needs={needs} ratings={ratings} />}
        />
      </div>
    ),

    // Фраза Здорового взрослого (перенесена с «Помощи»).
    phrase: () =>
      !today.phraseHidden ? (
        <div {...today.holdPhrase}>
          <PhraseShareCard />
        </div>
      ) : null,

    // Прогрессивное раскрытие: остальное — по желанию.
    secondary: () => (
      <>
        {today.secondaryHidden && (
          <button
            onClick={toggleMore}
            aria-expanded={moreOpen}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {moreOpen ? 'Свернуть' : 'Что ещё можно сегодня'}
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: moreOpen ? 'rotate(180deg)' : 'none',
              }}
            >
              ⌄
            </span>
          </button>
        )}
        {(!today.secondaryHidden || moreOpen) && (
          <SecondaryCards
            needs={needs}
            ratings={ratings}
            yesterdayRatings={yesterdayRatings}
            ratedCount={ratedCount}
            allRated={allRated}
            diariesLoaded={diariesLoaded}
            recentDiaries={recentDiaries}
            onOpenTrackerHistory={onOpenTrackerHistory}
            onOpenTrackerAt={onOpenTrackerAt}
            onOpenTracker={onOpenTracker}
            onOpenDiaries={onOpenDiaries}
            onSetDiaryTask={onSetDiaryTask}
          />
        )}
      </>
    ),
  };

  return (
    <>
      {today.orderedIds.map((id) => (
        <Fragment key={id}>{blocks[id]?.()}</Fragment>
      ))}
    </>
  );
}
