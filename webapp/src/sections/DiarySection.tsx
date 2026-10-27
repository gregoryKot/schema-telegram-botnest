import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../types';
import { api } from '../api';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { loadDraft, clearDraft } from '../utils/drafts';
import { DiaryEmptyExplainer } from '../components/diary/DiaryEmptyExplainer';
import { DiaryLoadFailedBanner } from '../components/diary/DiaryLoadFailedBanner';
import { QuickEntrySheet } from '../components/diary/QuickEntrySheet';
import { DiaryShareButton } from '../share/DiaryShareButton';
import '../styles/client-diary.css';
import { TODAY } from './diary/dateHelpers';
import { DiaryDraft } from './diary/DiaryDraft';
import { DiaryHeader } from './diary/DiaryHeader';
import { DiaryTimeline, DiaryTimelineSkeleton } from './diary/DiaryTimeline';
import { buildTrackerDays, type TrackerDay } from './diary/trackerEntries';
import {
  buildEntries, filterCounts, filterEntries, groupByDay, streakLine,
  type DiaryFilter,
} from './diary/diaryModel';

const FILTERS: { id: DiaryFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'tracker', label: 'Трекер' },
  { id: 'diary', label: 'Дневник' },
];
// Бэкенд отдаёт историю оценок не глубже 30 дней (tracker.controller.ts, GET /api/history).
const TRACKER_DAYS = 30;
const DRAFT_TYPES: DiaryType[] = ['schema', 'mode', 'gratitude'];

export function DiarySection({ onClose: _onClose, onOpenTrackerHistory }: { onClose?: () => void; onOpenTrackerHistory?: () => void } = {}) {
  const [schemaEntries,    setSchemaEntries]    = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries,      setModeEntries]      = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [activeSchemaIds,  setActiveSchemaIds]  = useState<string[] | undefined>(undefined);
  const [trackerDays,      setTrackerDays]      = useState<TrackerDay[]>([]);
  const [streak,           setStreak]           = useState(0);
  const [quickOpen,        setQuickOpen]        = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [filter,           setFilter]           = useState<DiaryFilter>('all');
  const [newEntry,         setNewEntry]         = useState<DiaryType | null>(null);
  const [draftKey,         setDraftKey]         = useState(0);
  // Сбой ≠ пусто (пара к miniapp): предупреждение сверху, а не тихое [].
  const [loadFailed,       setLoadFailed]       = useState(false);

  const load = useCallback(() =>
    Promise.all([
      api.getSchemaDiary(),
      api.getModeDiary(),
      api.getGratitudeDiary(),
      api.getProfile().catch(() => null), // профиль и трекер вспомогательные, их отказ не «сбой дневника»
      api.history(TRACKER_DAYS).catch(() => []),
    ]).then(([schema, mode, gratitude, profile, history]) => {
      setLoadFailed(false);
      setSchemaEntries(schema);
      setModeEntries(mode);
      setGratitudeEntries(gratitude);
      setTrackerDays(buildTrackerDays(history));
      if (profile) {
        setActiveSchemaIds(profile.ysq.activeSchemaIds);
        setStreak(profile.streak);
      }
    }).catch((err) => { console.error(err); setLoadFailed(true); })
      .finally(() => setLoading(false)),
  []);

  useEffect(() => { void load(); }, [load]);

  const todayGratitude = gratitudeEntries.find(e => e.date === TODAY);

  const handleDelete = async (type: DiaryType, id: number) => {
    if (type === 'schema')    { await api.deleteSchemaDiary(id);    setSchemaEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'mode')      { await api.deleteModeDiary(id);      setModeEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'gratitude') { await api.deleteGratitudeDiary(id); setGratitudeEntries(p => p.filter(e => e.id !== id)); }
  };

  const allEntries = useMemo(
    () => buildEntries(schemaEntries, modeEntries, gratitudeEntries, trackerDays),
    [schemaEntries, modeEntries, gratitudeEntries, trackerDays],
  );
  const groups = useMemo(() => groupByDay(filterEntries(allEntries, filter)), [allEntries, filter]);
  const counts = useMemo(() => filterCounts(allEntries), [allEntries]);
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
      date={TODAY}
      existingItems={todayGratitude?.items}
      onSave={async (date, items) => {
        const entry = await api.createGratitudeDiary(date, items);
        setGratitudeEntries(prev => {
          const rest = prev.filter(e => e.date !== date);
          return [entry, ...rest].sort((a, b) => b.date.localeCompare(a.date));
        });
        setNewEntry(null);
      }}
    />
  );

  return (
    <div className="ds-page cd-page">
      {loadFailed && <DiaryLoadFailedBanner onRetry={() => { void load(); }} />}

      <DiaryHeader onWrite={() => setQuickOpen(true)} />

      <div className="cd-drafts">
        {DRAFT_TYPES.filter(t => loadDraft(t)).map(type => (
          <DiaryDraft
            key={type + draftKey}
            type={type}
            onContinue={() => setNewEntry(type)}
            onDelete={() => { clearDraft(type); setDraftKey(k => k + 1); }}
          />
        ))}
      </div>

      <div className="cd-bar">
        <div className="ds-seg" role="group" aria-label="Тип записей">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={'ds-seg-btn' + (filter === f.id ? ' is-active' : '')}
              onClick={() => setFilter(f.id)}
            >
              {f.label}<span className="ds-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        {filter === 'diary' && counts.diary > 0 && (
          <DiaryShareButton emoji="📓" title="Мой дневник" color="var(--c-rose)" entries={[...schemaEntries, ...modeEntries, ...gratitudeEntries]} />
        )}
      </div>

      {loading && <DiaryTimelineSkeleton />}

      {/* Пустая лента: для новичка отвечает «что это и зачем», первое действие — кнопка «Записать» выше */}
      {!loading && groups.length === 0 && <DiaryEmptyExplainer filter={filter} />}

      {!loading && groups.length > 0 && <DiaryTimeline groups={groups} onDelete={handleDelete} onOpenTrackerHistory={onOpenTrackerHistory} />}

      {streakText && <p className="cd-streak">{streakText}</p>}

      {quickOpen && <QuickEntrySheet onClose={() => setQuickOpen(false)} onSaved={() => { void load(); }} />}
    </div>
  );
}
