import { useState } from 'react';
import type { Need } from '../types';
import { CaseFlowHost } from '../components/caseFlow/CaseFlowHost';
import { WhySheet } from '../components/WhySheet';
import '../styles/client-today.css';
import { HomeTiles } from './today/HomeTiles';
import { useTodayData } from './today/useTodayData';
import { useWhySheet } from './today/useWhySheet';
import { trackHomeTile } from './today/trackHomeTile';
import { TodayHead } from './today/TodayHead';
import { trackerSummary, trackerTileMeta, caseTileMeta, diaryTileMeta, diaryEntriesToday } from './today/todayFeedModel';
import { QuickEntrySheet } from '../components/diary/QuickEntrySheet';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  onOpenTracker: () => void;
  refreshKey?: number;
}

// Главная «Сегодня» (docs/design/CLIENT_SIMPLE_2026-10.md): приветствие, «Зачем это?»
// и три действия — трекер, «Что случилось», дневник (лист QuickEntrySheet). Владелец
// 2026-11-05: «на экране только 3 кнопки и больше ничего» — задания, лента дня,
// сигнальная карточка, «Подышим» и строка про терапию переехали на «Ещё».
export function TodaySection({ needs, ratings, onOpenSchema, onOpenTracker, refreshKey }: Props) {
  const data = useTodayData(refreshKey);
  const { profile, feed, casesToday, lastAt, diariesLoaded, reloadDiaries } = data;
  const [caseOpen, setCaseOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const tracker = trackerSummary(needs.map(n => n.id), ratings);
  const why = useWhySheet({
    ready: profile !== null && diariesLoaded,
    hasHistory: tracker.filled > 0 || lastAt !== null,
  });
  const firstName = profile?.name?.split(' ')[0] ?? '';

  return (
    <div className="ds-page ct-page">
      <TodayHead firstName={firstName} onWhy={why.open} />

      <HomeTiles
        ratings={ratings}
        tracker={tracker}
        trackerMeta={trackerTileMeta(tracker)}
        caseMeta={caseTileMeta(casesToday)}
        diaryMeta={diaryTileMeta(diariesLoaded, diaryEntriesToday(feed), lastAt)}
        onTracker={() => { trackHomeTile('tracker'); onOpenTracker(); }}
        onCase={() => { trackHomeTile('case'); setCaseOpen(true); }}
        onDiary={() => { trackHomeTile('diary'); setQuickOpen(true); }}
      />

      {quickOpen && <QuickEntrySheet onClose={() => setQuickOpen(false)} onSaved={reloadDiaries} />}
      {why.mode && <WhySheet auto={why.mode === 'auto'} onClose={why.close} />}
      {caseOpen && (
        <CaseFlowHost
          start="flow"
          onClose={() => { setCaseOpen(false); reloadDiaries(); }}
          onOpenTracker={onOpenTracker}
          onOpenSchema={onOpenSchema}
        />
      )}
    </div>
  );
}
