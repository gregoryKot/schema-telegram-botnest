import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Achievement, TherapyRelationInfo } from '../api';
import { TherapyNote } from '../components/TherapyNote';
import { JourneySheet } from '../components/JourneySheet';
import { Skeleton } from '../components/Skeleton';
import { useTr } from '../utils/addressForm';
import { AchievementDetail } from '../components/AchievementDetail';
import { pressable } from '../utils/a11y';
import '../styles/client-profile.css'; import '../styles/client-profile-mobile.css';
import { DeleteAccountDialog } from './profile/DeleteAccountDialog';
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileCounters } from './profile/ProfileCounters';
import { StreakCard } from './profile/StreakCard';
import { ActivityHeatmap } from './profile/ActivityHeatmap';
import { AchievementsCard } from './profile/AchievementsCard';
import { AchievementsDialog } from './profile/AchievementsDialog';
import { PatternsCard } from './profile/PatternsCard';
import { TherapistCard } from './profile/TherapistCard';
import { ProfileLinks } from './profile/ProfileLinks';
import { ProfileAboutBlock } from './profile/ProfileAboutBlock';
import { ScreenBlock } from '../components/customize/ScreenBlock';
import { ScreenCustomizeHost } from '../components/customize/ScreenCustomizeHost';
import { useScreenBlocks } from '../components/customize/useScreenBlocks';
import { BestDayDialog } from './profile/BestDayDialog';
import { ACHIEVEMENT_META } from './profile/profileMeta';
import type { InsightsData, StreakData } from './profile/profileMeta';
import { buildLevelMap } from './profile/profileModel';

export const DEFAULT_SECTION_KEY = 'default_section';

interface Props {
  onOpenSettings?: () => void;
  onOpenTracker?: () => void;
  refreshKey?: number;
  displayName?: string | null;
  onTakeTest?: () => void;
}

export function ProfileSection({ onOpenSettings, onOpenTracker, refreshKey, displayName, onTakeTest }: Props) {
  const tr = useTr();
  const blocks = useScreenBlocks('profile');

  const [streak, setStreak]             = useState<StreakData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [insights, setInsights]         = useState<InsightsData | null>(null);
  const [ready, setReady]               = useState(false);
  const [levels, setLevels]             = useState<Map<string, number>>(new Map());

  const [journeyOpen, setJourneyOpen] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(null);
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [relation, setRelation] = useState<TherapyRelationInfo | null>(null);
  const [diaryCount, setDiaryCount] = useState<number>(0);
  const [ysqCount, setYsqCount] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset to the loading state when a refresh is requested. Adjusting state
  // during render (not in an effect) keeps this off set-state-in-effect; on
  // mount these already start null/false.
  const [seenRefresh, setSeenRefresh] = useState(refreshKey);
  if (refreshKey !== seenRefresh) {
    setSeenRefresh(refreshKey);
    setReady(false);
    setStreak(null);
    setAchievements(null);
    setInsights(null);
    setLoadError(false);
  }

  // Сбой любого фетча раньше глотался поодиночке — экран уходил в "ready" с
  // молчаливыми нулями вместо реальных данных. Теперь виден баннером.
  useEffect(() => {
    Promise.all([
      api.getStreak().then(setStreak),
      api.getAchievements().then(setAchievements),
      api.getInsights().then(setInsights),
      api.history(112).then(h => setLevels(buildLevelMap(h))),
      api.getTherapyRelation().then(r => setRelation(r)),
      Promise.all([api.getSchemaDiary(), api.getModeDiary(), api.getGratitudeDiary()])
        .then(([sd, md, gd]) => setDiaryCount(sd.length + md.length + gd.length)),
      api.getYsqHistory().then(h => setYsqCount(h.length)),
    ]).catch(() => setLoadError(true)).finally(() => setReady(true));
  }, [refreshKey]);

  const activeDates = useMemo(() => new Set(levels.keys()), [levels]);
  const currentStreak = streak?.currentStreak ?? 0;
  const totalDays     = streak?.totalDays ?? 0;
  const hasInsights   = insights && insights.weeklyStats.some(s => s.avg !== null);
  const hasAchievementsCard = !!achievements && !blocks.isHidden('achievements');
  const showInsights = !!hasInsights && !blocks.isHidden('insights');

  return (
    <div className="ds-page cpf-page animate-fade">
      <ProfileHeader displayName={displayName} totalDays={totalDays} onCustomize={blocks.openByGear} onOpenSettings={onOpenSettings} />

      {!ready && (
        <div className="cpf-skeleton">
          {[110, 96, 160].map((h, i) => <Skeleton key={i} height={h} radius={20} />)}
        </div>
      )}

      {ready && loadError && (
        <div role="alert" className="cpf-error">
          {tr('Не удалось загрузить часть данных. Обнови страницу.', 'Не удалось загрузить часть данных. Обновите страницу.')}
        </div>
      )}

      {ready && (
        <>
          <ScreenBlock id="journey" blocks={blocks} className="cpf-blk">
            <section {...pressable(() => setJourneyOpen(true))} className="ds-card ds-card--hover cpf-card cpf-journey">
              <div className="ds-head-row">
                <h2 className="ds-h3">Мой путь</h2>
                <span className="ds-sub">→</span>
              </div>
              <div className="ds-sub">
                {tr(
                  'Вся твоя история в одном месте: трекер, дневники, практики и тесты — и красивая карточка, чтобы поделиться.',
                  'Вся ваша история в одном месте: трекер, дневники, практики и тесты — и красивая карточка, чтобы поделиться.',
                )}
              </div>
            </section>
          </ScreenBlock>

          <ProfileCounters streak={currentStreak} totalDays={totalDays} diaryCount={diaryCount} ysqCount={ysqCount} />
          {streak !== null && <ScreenBlock id="streak" blocks={blocks} className="cpf-blk"><StreakCard streak={streak} onOpenTracker={onOpenTracker} /></ScreenBlock>}
          {activeDates.size > 0 && (
            <ScreenBlock id="heatmap" blocks={blocks} className="cpf-blk">
              <ActivityHeatmap levels={levels} activeDates={activeDates} totalDays={totalDays} />
            </ScreenBlock>
          )}

          <ProfileAboutBlock refreshKey={refreshKey} onTakeTest={onTakeTest} blocks={blocks} />

          {(hasAchievementsCard || showInsights) && (
            <div className="cpf-duo">
              {hasAchievementsCard && achievements && (
                <ScreenBlock id="achievements" blocks={blocks} className="cpf-blk">
                  <AchievementsCard achievements={achievements} onOpen={() => setShowAchievements(true)} />
                </ScreenBlock>
              )}
              {showInsights && insights && (
                <ScreenBlock id="insights" blocks={blocks} className="cpf-blk">
                  <PatternsCard insights={insights} onBestDayInfo={() => setShowBestDayInfo(true)} />
                </ScreenBlock>
              )}
            </div>
          )}

          <TherapistCard relation={relation} />
        </>
      )}

      <TherapyNote compact />

      {ready && <ProfileLinks onOpenSettings={onOpenSettings} onDeleteAccount={() => setShowDeleteConfirm(true)} />}

      {/* Список прячем, пока открыта деталь (когда-то — из-за драки двух
          фокус-ловушек; теперь трап у верхнего слоя, dialogStack) */}
      {showAchievements && achievements && !selectedAchievement && (
        <AchievementsDialog
          achievements={achievements}
          currentStreak={currentStreak}
          totalDays={totalDays}
          onSelect={setSelectedAchievement}
          onClose={() => { setShowAchievements(false); setSelectedAchievement(null); }}
        />
      )}

      {/* Achievement detail overlay (share-карточка внутри) */}
      {selectedAchievement && ACHIEVEMENT_META[selectedAchievement] && (
        <AchievementDetail
          meta={ACHIEVEMENT_META[selectedAchievement]}
          onClose={() => setSelectedAchievement(null)}
        />
      )}

      {showBestDayInfo && <BestDayDialog onClose={() => setShowBestDayInfo(false)} />}

      {journeyOpen && <JourneySheet onClose={() => setJourneyOpen(false)} />}

      {showDeleteConfirm && <DeleteAccountDialog onClose={() => setShowDeleteConfirm(false)} />}

      <ScreenCustomizeHost blocks={blocks} />
    </div>
  );
}
