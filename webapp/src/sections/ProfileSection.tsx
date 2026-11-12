import { useEffect, useMemo, useState } from 'react';
import { api, reportClientError } from '../api';
import type { Achievement, TherapyRelationInfo } from '../api';
import { TherapyNote } from '../components/TherapyNote';
import { JourneySheet } from '../components/JourneySheet';
import { PaperAlert } from '../components/paper/PaperAlert';
import { useTr } from '../utils/addressForm';
import { AchievementDetail } from '../components/AchievementDetail';
import '../styles/client-profile.css'; import '../styles/client-profile-mobile.css';
import { DeleteAccountDialog } from '../components/DeleteAccountDialog';
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileShelf } from './profile/ProfileShelf';
import { RhythmBlock } from './profile/RhythmBlock';
import { ProfileStart } from './profile/ProfileStart';
import { ProfileSkeleton } from './profile/ProfileSkeleton';
import { AchievementsCard } from './profile/AchievementsCard';
import { AchievementsDialog } from './profile/AchievementsDialog';
import { PatternsCard } from './profile/PatternsCard';
import { TherapistCard } from './profile/TherapistCard';
import { ProfileLinks } from './profile/ProfileLinks';
import { ScreenBlock } from '../components/customize/ScreenBlock';
import { ScreenCustomizeHost } from '../components/customize/ScreenCustomizeHost';
import { useScreenBlocks } from '../components/customize/useScreenBlocks';
import { BestDayDialog } from './profile/BestDayDialog';
import { ACHIEVEMENT_META } from './profile/profileMeta';
import type { InsightsData, StreakData } from './profile/profileMeta';
import { buildLevelMap } from './profile/profileModel';
import { isFreshProfile } from './profile/profileLayout';
import { badgeLook } from './profile/achievementBadgeLook';
import { useAboutMe } from '../../../shared/src/portrait/useAboutMe';
import { hasPortraitData } from '../../../shared/src/portrait/portraitData';

export const DEFAULT_SECTION_KEY = 'default_section';

interface Props {
  onOpenSettings?: () => void; onOpenTracker?: () => void; onTakeTest?: () => void;
  refreshKey?: number; displayName?: string | null;
}

export function ProfileSection({ onOpenSettings, onOpenTracker, refreshKey, displayName, onTakeTest }: Props) {
  const tr = useTr();
  const blocks = useScreenBlocks('profile');
  // Дневники схем и режимов читает только useAboutMe — счётчик записей, портрет и его лист берут их оттуда.
  const aboutMe = useAboutMe(api, { refreshKey, reportError: (message) => reportClientError({ message, section: 'profile-about' }) });

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
  const [gratitudeCount, setGratitudeCount] = useState<number>(0);
  const [ysqCount, setYsqCount] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Refresh → back to loading. State is adjusted during render (not in an effect) to stay off set-state-in-effect.
  const [seenRefresh, setSeenRefresh] = useState(refreshKey);
  if (refreshKey !== seenRefresh) {
    setSeenRefresh(refreshKey); setReady(false); setStreak(null); setAchievements(null); setInsights(null); setLoadError(false);
  }

  // Сбой любого фетча (и дневников useAboutMe) виден PaperAlert, а не молчаливыми нулями.
  useEffect(() => {
    Promise.all([
      api.getStreak().then(setStreak),
      api.getAchievements().then(setAchievements),
      api.getInsights().then(setInsights),
      api.history(112).then(h => setLevels(buildLevelMap(h))),
      api.getTherapyRelation().then(r => setRelation(r)),
      api.getGratitudeDiary().then(g => setGratitudeCount(g.length)),
      api.getYsqHistory().then(h => setYsqCount(h.length)),
    ]).catch(() => setLoadError(true)).finally(() => setReady(true));
  }, [refreshKey]);

  // Силуэт держится, пока не готово всё: пустой профиль от полного отличается только по всем данным сразу.
  const shown = ready && aboutMe.diaries !== 'loading' && aboutMe.portraitReady && aboutMe.warmWordsReady;
  const failed = loadError || aboutMe.diaries === 'failed';
  const diaryCount = aboutMe.schemaEntries.length + aboutMe.modeEntries.length + gratitudeCount;
  const activeDates = useMemo(() => new Set(levels.keys()), [levels]);
  const currentStreak = streak?.currentStreak ?? 0;
  const totalDays     = streak?.totalDays ?? 0;
  const fresh = !failed && isFreshProfile({
    totalDays, diaryCount, ysqCount, warmWords: aboutMe.warmWordsItems.length, earnedAchievements: achievements?.filter(a => a.earned).length ?? 0,
    patterns: (hasPortraitData(aboutMe.portrait) ? 1 : 0) + aboutMe.portrait.totalModes,
  });
  const hasInsights   = insights && insights.weeklyStats.some(s => s.avg !== null);
  const hasAchievementsCard = !!achievements && !blocks.isHidden('achievements');
  const showInsights = !!hasInsights && !blocks.isHidden('insights');

  return (
    <div className="ds-page cpf-page animate-fade">
      <ProfileHeader displayName={displayName} totalDays={totalDays} onCustomize={blocks.openByGear} onOpenSettings={onOpenSettings} />

      {!shown && <ProfileSkeleton />}

      {shown && failed && (
        <PaperAlert className="cpf-error" sign="leaf"
          title={tr('Не удалось загрузить часть данных. Обнови страницу.', 'Не удалось загрузить часть данных. Обновите страницу.')} />
      )}

      {shown && fresh && <ScreenBlock id="portrait" blocks={blocks} className="cpf-blk"><ProfileStart onTakeTest={onTakeTest} /></ScreenBlock>}

      {shown && !fresh && (
        <>
          <ProfileShelf aboutMe={aboutMe} blocks={blocks} onOpenJourney={() => setJourneyOpen(true)} onTakeTest={onTakeTest} />
          <RhythmBlock blocks={blocks} streak={streak} levels={levels} activeDates={activeDates} diaryCount={diaryCount} ysqCount={ysqCount} onOpenTracker={onOpenTracker} />
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
        </>
      )}

      {shown && <TherapistCard relation={relation} />}

      <TherapyNote compact />

      {shown && <ProfileLinks onOpenSettings={onOpenSettings} onDeleteAccount={() => setShowDeleteConfirm(true)} />}

      {/* Список прячем, пока открыта деталь (трап у верхнего слоя, dialogStack) */}
      {showAchievements && achievements && !selectedAchievement && (
        <AchievementsDialog achievements={achievements} currentStreak={currentStreak} totalDays={totalDays}
          onSelect={setSelectedAchievement} onClose={() => { setShowAchievements(false); setSelectedAchievement(null); }} />
      )}

      {selectedAchievement && ACHIEVEMENT_META[selectedAchievement] && (
        <AchievementDetail meta={ACHIEVEMENT_META[selectedAchievement]} look={badgeLook(selectedAchievement)} onClose={() => setSelectedAchievement(null)} />
      )}

      {showBestDayInfo && <BestDayDialog onClose={() => setShowBestDayInfo(false)} />}
      {journeyOpen && <JourneySheet onClose={() => setJourneyOpen(false)} />}
      {showDeleteConfirm && <DeleteAccountDialog onClose={() => setShowDeleteConfirm(false)} />}
      <ScreenCustomizeHost blocks={blocks} />
    </div>
  );
}
