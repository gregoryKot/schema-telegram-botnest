import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../types';
import { api } from '../api';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { loadDraft, clearDraft } from '../utils/drafts';
import { DiaryEmptyExplainer } from '../components/diary/DiaryEmptyExplainer';
import { DiaryLoadFailedBanner } from '../components/diary/DiaryLoadFailedBanner';
import { DiaryShareButton } from '../share/DiaryShareButton';
import '../styles/client-diary.css';
import { diaryRowMeta, trackerRowMeta } from '../../../shared/src/diary/diaryMeta';
import { diaryToday } from '../../../shared/src/diary/diaryDay';
import { DiaryDraft } from './diary/DiaryDraft';
import { DiaryHeader } from './diary/DiaryHeader';
import { DiaryQuickAdd } from './diary/DiaryQuickAdd';
import { DiaryTrackerLink } from './diary/DiaryTrackerLink';
import { DiaryTimeline, DiaryTimelineSkeleton } from './diary/DiaryTimeline';
import {
  buildEntries, filterCounts, filterEntries, groupByDay, monthStats, streakDays,
  type DiaryFilter,
} from './diary/diaryModel';

const FILTERS: { id: DiaryFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'schema', label: 'Схемы' },
  { id: 'mode', label: 'Режимы' },
  { id: 'gratitude', label: 'Благодарность' },
];
const DRAFT_TYPES: DiaryType[] = ['schema', 'mode', 'gratitude'];

export function DiarySection({ onClose: _onClose, onOpenTracker }: { onClose?: () => void; onOpenTracker?: () => void } = {}) {
  const [schemaEntries,    setSchemaEntries]    = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries,      setModeEntries]      = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [activeSchemaIds,  setActiveSchemaIds]  = useState<string[] | undefined>(undefined);
  // Последняя отметка трекера — из профиля; на чистом аккаунте строка «Пока пусто».
  const [lastNeedsDate,    setLastNeedsDate]    = useState<string | undefined>(undefined);
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
      api.getProfile().catch(() => null), // профиль вспомогательный, его отказ не «сбой дневника»
    ]).then(([schema, mode, gratitude, profile]) => {
      setLoadFailed(false);
      setSchemaEntries(schema);
      setModeEntries(mode);
      setGratitudeEntries(gratitude);
      if (profile) {
        setActiveSchemaIds(profile.ysq.activeSchemaIds);
        setLastNeedsDate(profile.lastActivity?.needsTracker ?? undefined);
      }
    }).catch((err) => { console.error(err); setLoadFailed(true); })
      .finally(() => setLoading(false)),
  []);

  useEffect(() => { void load(); }, [load]);

  const today = diaryToday(); // местный день, на каждый рендер (не на загрузку)
  const todayGratitude = gratitudeEntries.find(e => e.date === today);

  const handleDelete = async (type: DiaryType, id: number) => {
    if (type === 'schema')    { await api.deleteSchemaDiary(id);    setSchemaEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'mode')      { await api.deleteModeDiary(id);      setModeEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'gratitude') { await api.deleteGratitudeDiary(id); setGratitudeEntries(p => p.filter(e => e.id !== id)); }
  };

  const allEntries = useMemo(
    () => buildEntries(schemaEntries, modeEntries, gratitudeEntries),
    [schemaEntries, modeEntries, gratitudeEntries],
  );
  const groups = useMemo(() => groupByDay(filterEntries(allEntries, filter)), [allEntries, filter]);
  const counts = useMemo(() => filterCounts(allEntries), [allEntries]);
  const { daysWithEntry, daysInMonth } = monthStats(allEntries, today);
  const streak = streakDays(allEntries, today);
  const totalCount = allEntries.length;

  const hubMeta = loading || loadFailed ? undefined : {
    schema:    diaryRowMeta(schemaEntries.length, schemaEntries[0]?.createdAt),
    mode:      diaryRowMeta(modeEntries.length, modeEntries[0]?.createdAt),
    gratitude: diaryRowMeta(gratitudeEntries.length, gratitudeEntries[0]?.date),
  };

  // Мета для карточки шаринга «сводка дневника» — только для конкретного типа.
  const SHARE_META: Record<DiaryType, { emoji: string; title: string; color: string; entries: { createdAt: string }[] }> = {
    schema:    { emoji: '📓', title: 'Дневник схем',         color: 'var(--c-rose)',  entries: schemaEntries },
    mode:      { emoji: '🔄', title: 'Дневник режимов',      color: 'var(--c-slate)', entries: modeEntries },
    gratitude: { emoji: '🌱', title: 'Дневник благодарности', color: 'var(--c-moss)', entries: gratitudeEntries },
  };

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

      <DiaryHeader total={totalCount} daysWithEntry={daysWithEntry} daysInMonth={daysInMonth} streak={streak} />

      <DiaryQuickAdd onOpen={setNewEntry} meta={hubMeta} />

      {onOpenTracker && <DiaryTrackerLink onOpen={onOpenTracker} meta={loading || loadFailed ? undefined : trackerRowMeta(lastNeedsDate)} />}

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
        {totalCount > 0 && <span className="ds-label">Архив · {totalCount}</span>}
        {filter !== 'all' && totalCount > 0 && <DiaryShareButton {...SHARE_META[filter]} />}
      </div>

      {loading && <DiaryTimelineSkeleton />}

      {/* Пустой архив: для новичка отвечает «что это и зачем», первое действие — карточки выше */}
      {!loading && groups.length === 0 && <DiaryEmptyExplainer filter={filter} />}

      {!loading && groups.length > 0 && <DiaryTimeline groups={groups} onDelete={handleDelete} />}
    </div>
  );
}
