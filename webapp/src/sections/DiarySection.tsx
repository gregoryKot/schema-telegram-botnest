import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryType } from '../types';
import { api } from '../api';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { loadDraft, clearDraft } from '../utils/drafts';
import { QuickEntrySheet } from '../components/diary/QuickEntrySheet';
import { TherapyLine } from '../components/therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../components/therapy/useTherapyBridgeTexts';
import { DiaryShareButton } from '../share/DiaryShareButton';
import '../styles/client-diary.css';
import { diaryToday } from '../../../shared/src/diary/diaryDay';
import { deleteDiaryEntry } from '../../../shared/src/diary/diaryDelete';
import { DiaryDraft } from './diary/DiaryDraft';
import { DiaryHeader } from './diary/DiaryHeader';
import { DiaryBar } from './diary/DiaryBar';
import { DiaryFeed } from './diary/DiaryFeed';
import { buildTrackerDays, type TrackerDay } from './diary/trackerEntries';
import { fetchFirstDiaryPages, useDiaryLists } from './diary/useDiaryLists';
import { diaryWeek, segCounts } from './diary/dayModel';
import { buildEntries, filterCounts, filterEntries, groupByDay, streakLine, type DiaryFilter } from './diary/diaryModel';
import { glue } from '../../../shared/src/utils/typo';

// Год — потолок GET /api/history (HISTORY_MAX_DAYS, src/api/dto/history-query.dto.ts).
const TRACKER_DAYS = 365;
const DRAFT_TYPES: DiaryType[] = ['schema', 'mode', 'gratitude'];

// «Записи» клиента — раздел и лист «Дневники» (DiariesOverlay рисует свою шапку с «Назад»).
export function DiarySection({ onOpenTrackerHistory }: { onOpenTrackerHistory?: () => void } = {}) {
  const bridge = useTherapyBridgeTexts();
  // Три дневника постранично: «Показать ещё» догружает старые (R6).
  const lists = useDiaryLists();
  const { schema: schemaEntries, mode: modeEntries, gratitude: gratitudeEntries, setSchema: setSchemaEntries, setMode: setModeEntries, setGratitude: setGratitudeEntries, applyFirst } = lists;
  const [activeSchemaIds,  setActiveSchemaIds]  = useState<string[] | undefined>(undefined);
  const [trackerDays,      setTrackerDays]      = useState<TrackerDay[]>([]);
  const [streak,           setStreak]           = useState(0);
  const [quickOpen,        setQuickOpen]        = useState(false);
  // Сбой истории трекера ≠ «отметок нет»: строки трекера не появятся, и об этом говорим.
  const [trackerFailed,    setTrackerFailed]    = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [filter,           setFilter]           = useState<DiaryFilter>('all');
  const [newEntry,         setNewEntry]         = useState<DiaryType | null>(null);
  const [draftKey,         setDraftKey]         = useState(0);
  // Сбой ≠ пусто (пара к miniapp): строка-лист на месте ленты, а не тихое [].
  const [loadFailed,       setLoadFailed]       = useState(false);

  const load = useCallback(() =>
    Promise.all([
      fetchFirstDiaryPages(),
      api.getProfile().catch(() => null), // профиль и трекер вспомогательные, их отказ не «сбой дневника»
      api.history(TRACKER_DAYS).then(days => ({ days, ok: true }), () => ({ days: [], ok: false })),
    ]).then(([pages, profile, tracker]) => {
      setLoadFailed(false);
      applyFirst(pages);
      setTrackerFailed(!tracker.ok);
      setTrackerDays(buildTrackerDays(tracker.days));
      if (profile) {
        setActiveSchemaIds(profile.ysq.activeSchemaIds);
        setStreak(profile.streak);
      }
    }).catch((err) => { console.error(err); setLoadFailed(true); })
      .finally(() => setLoading(false)),
  [applyFirst]);

  useEffect(() => { void load(); }, [load]);

  const today = diaryToday(); // местный день, на каждый рендер (не на загрузку)
  const todayGratitude = gratitudeEntries.find(e => e.date === today);

  // Сбой удаления доходит до кнопки (текст ошибки, запись на месте); 404 — записи уже нет.
  const handleDelete = async (type: DiaryType, id: number) => {
    await deleteDiaryEntry(api, type, id);
    if (type === 'schema')    setSchemaEntries(p => p.filter(e => e.id !== id));
    if (type === 'mode')      setModeEntries(p => p.filter(e => e.id !== id));
    if (type === 'gratitude') setGratitudeEntries(p => p.filter(e => e.id !== id));
  };

  const allEntries = useMemo(
    () => buildEntries(schemaEntries, modeEntries, gratitudeEntries, trackerDays),
    [schemaEntries, modeEntries, gratitudeEntries, trackerDays],
  );
  const groups = useMemo(() => groupByDay(filterEntries(allEntries, filter)), [allEntries, filter]);
  const counts = useMemo(() => filterCounts(allEntries), [allEntries]);
  const week = diaryWeek(allEntries, lists, today); // «Эта неделя» справа от ленты на широком экране
  const streakText = loading ? null : streakLine(streak);

  // Show entry sheet instead of hub
  if (newEntry === 'schema') return (
    <SchemaEntrySheet
      activeSchemaIds={activeSchemaIds}
      onClose={() => setNewEntry(null)}
      onSave={async data => {
        const entry = await api.createSchemaDiary(data);
        setSchemaEntries(prev => [entry, ...prev]);
        setNewEntry(null);
      }}
    />
  );
  if (newEntry === 'mode') return (
    <ModeEntrySheet
      onClose={() => setNewEntry(null)}
      onSave={async data => {
        const entry = await api.createModeDiary(data);
        setModeEntries(prev => [entry, ...prev]);
        setNewEntry(null);
      }}
    />
  );
  if (newEntry === 'gratitude') return (
    <GratitudeEntrySheet
      onClose={() => setNewEntry(null)}
      date={today}
      existingItems={todayGratitude?.items}
      onSave={async (date, items, base) => {
        const entry = await api.createGratitudeDiary(date, items, base);
        setGratitudeEntries(prev => {
          const rest = prev.filter(e => e.date !== date);
          return [entry, ...rest].sort((a, b) => b.date.localeCompare(a.date));
        });
        setNewEntry(null);
      }}
    />
  );

  const drafts = DRAFT_TYPES.filter(t => loadDraft(t));
  return (
    <div className="ds-page cd-page">
      <DiaryHeader onWrite={() => setQuickOpen(true)} />

      {drafts.length > 0 && <div className="cd-drafts">{/* пустая обёртка удваивала gap (page-rhythm.spec.ts) */}
        {drafts.map(type => (
          <DiaryDraft key={type + draftKey} type={type} onContinue={() => setNewEntry(type)}
            onDelete={() => { clearDraft(type); setDraftKey(k => k + 1); }} />
        ))}
      </div>}

      <DiaryBar filter={filter} counts={segCounts(counts, { loading, loadFailed, trackerFailed })} onFilter={setFilter} streak={streakText} share={filter === 'diary' && counts.diary > 0 && (
        <DiaryShareButton emoji="📓" title="Мой дневник" color="var(--c-rose)" entries={[...schemaEntries, ...modeEntries, ...gratitudeEntries]} />
      )} />

      <DiaryFeed
        loading={loading} loadFailed={loadFailed} trackerFailed={trackerFailed} filter={filter} groups={groups} week={week}
        more={{ has: lists.hasMore, state: lists.moreState, load: () => { void lists.loadMore(); } }}
        onRetry={() => { void load(); }} onDelete={handleDelete} onOpenTrackerHistory={onOpenTrackerHistory}
      />

      {quickOpen && <QuickEntrySheet onClose={() => setQuickOpen(false)} onSaved={() => { void load(); }} />}

      <TherapyLine place="diary" text={glue(bridge.lineDiaryList)} />
    </div>
  );
}
