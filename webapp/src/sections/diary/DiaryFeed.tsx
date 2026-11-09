// Тело ленты «Записей» под сегментом (b11): сбой загрузки, силуэт, пустое состояние, дни и «Показать
// ещё»; на широком экране справа — «Эта неделя». Пусто ≠ сбой ≠ загрузка (APP_2026-11.md, принцип 8):
// при сбое — строка-лист PaperAlert и неподвижный силуэт ленты, а не объяснение новичка «пока ни одной
// записи» (записи на сервере есть, просто не загрузились); сбой трекера — та же строка, а не серый текст.
import type { DiaryType } from '../../types';
import { DiaryEmptyExplainer } from '../../components/diary/DiaryEmptyExplainer';
import { DiaryLoadFailedBanner } from '../../components/diary/DiaryLoadFailedBanner';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { DiaryTimeline } from './DiaryTimeline';
import { DiaryTimelineSkeleton } from './DiaryFeedSkeleton';
import { DiaryMore } from './DiaryMore';
import { WeekSummary } from './WeekSummary';
import type { WeekRow } from './dayModel';
import type { AnyEntry, DiaryFilter } from './diaryModel';
import type { MoreState } from './useDiaryLists';

export interface DiaryFeedProps {
  loading: boolean;
  loadFailed: boolean;
  trackerFailed: boolean;
  filter: DiaryFilter;
  groups: { dateKey: string; items: AnyEntry[] }[];
  week: WeekRow[];
  more: { has: boolean; state: MoreState; load: () => void };
  onRetry: () => void;
  onDelete: (type: DiaryType, id: number) => Promise<void>;
  onOpenTrackerHistory?: () => void;
}

export function DiaryFeed({ loading, loadFailed, trackerFailed, filter, groups, week, more, onRetry, onDelete, onOpenTrackerHistory }: DiaryFeedProps) {
  if (loading) return <DiaryTimelineSkeleton />;
  if (loadFailed) return <><DiaryLoadFailedBanner onRetry={onRetry} /><DiaryTimelineSkeleton still /></>;
  return (
    <>
      {trackerFailed && <PaperAlert title="Отметки трекера не загрузились." sign="strokes" role="status" onRetry={onRetry} className="cd-alert" />}
      {groups.length === 0 ? <DiaryEmptyExplainer filter={filter} /> : (
        <div className={week.length > 0 ? 'cd-feed cd-feed--week' : 'cd-feed'}>
          <div className="cd-feed-main">
            <DiaryTimeline groups={groups} onDelete={onDelete} onOpenTrackerHistory={onOpenTrackerHistory} />
            {more.has && filter !== 'tracker' && <DiaryMore state={more.state} onMore={more.load} />}
          </div>
          <WeekSummary rows={week} />
        </div>
      )}
    </>
  );
}
