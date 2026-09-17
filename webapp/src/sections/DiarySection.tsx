import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../types';
import { api } from '../api';
import { pressable } from '../utils/a11y';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { loadDraft, clearDraft } from '../utils/drafts';
import { DiaryEmptyExplainer } from '../components/diary/DiaryEmptyExplainer';
import { DiaryLoadFailedBanner } from '../components/diary/DiaryLoadFailedBanner';
import { DiaryShareButton } from '../share/DiaryShareButton';
import {
  TODAY,
  fmtDateKey,
  fmtDayMonth,
  fmtWeekday,
  dateRelLabel,
} from './diary/dateHelpers';
import {
  SchemaEntry,
  ModeEntry,
  GratitudeEntry,
  DraftBanner,
} from './diary/EntryCards';

// ─── Unified entry type ───────────────────────────────────────────────────────

type AnyEntry =
  | { _type: 'schema';    sortKey: string; dateKey: string; entry: SchemaDiaryEntry }
  | { _type: 'mode';      sortKey: string; dateKey: string; entry: ModeDiaryEntry }
  | { _type: 'gratitude'; sortKey: string; dateKey: string; entry: GratitudeDiaryEntry };

type Filter = 'all' | DiaryType;

// ─── Main component ───────────────────────────────────────────────────────────

export function DiarySection({ onClose: _onClose }: { onClose?: () => void } = {}) {
  const [schemaEntries,    setSchemaEntries]    = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries,      setModeEntries]      = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [activeSchemaIds,  setActiveSchemaIds]  = useState<string[] | undefined>(undefined);
  const [loading,          setLoading]          = useState(true);
  const [filter,           setFilter]           = useState<Filter>('all');
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
      if (profile) setActiveSchemaIds(profile.ysq.activeSchemaIds);
    }).catch((err) => { console.error(err); setLoadFailed(true); })
      .finally(() => setLoading(false)),
  []);

  useEffect(() => { void load(); }, [load]);

  const todayGratitude = gratitudeEntries.find(e => e.date === TODAY);
  const totalCount = schemaEntries.length + modeEntries.length + gratitudeEntries.length;

  // Streak / days-this-month stats
  const allDateKeys = [
    ...schemaEntries.map(e => fmtDateKey(e.createdAt)),
    ...modeEntries.map(e => fmtDateKey(e.createdAt)),
    ...gratitudeEntries.map(e => e.date),
  ];
  const uniqueDates = [...new Set(allDateKeys)].sort().reverse();

  const thisMonth = new Date().toISOString().slice(0, 7);
  const daysThisMonth = uniqueDates.filter(d => d.startsWith(thisMonth)).length;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  let streak = 0;
  const today = new Date(TODAY);
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (uniqueDates.includes(key)) streak++;
    else if (i > 0) break;
  }

  const handleDelete = async (type: DiaryType, id: number) => {
    if (type === 'schema')    { await api.deleteSchemaDiary(id);    setSchemaEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'mode')      { await api.deleteModeDiary(id);      setModeEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'gratitude') { await api.deleteGratitudeDiary(id); setGratitudeEntries(p => p.filter(e => e.id !== id)); }
  };

  // Build unified sorted list
  const allEntries: AnyEntry[] = useMemo(() => [
    ...schemaEntries.map(e => ({ _type: 'schema' as const, sortKey: e.createdAt, dateKey: fmtDateKey(e.createdAt), entry: e })),
    ...modeEntries.map(e =>   ({ _type: 'mode'   as const, sortKey: e.createdAt, dateKey: fmtDateKey(e.createdAt), entry: e })),
    ...gratitudeEntries.map(e => ({ _type: 'gratitude' as const, sortKey: e.date + 'T12:00:00', dateKey: e.date, entry: e })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey)), [schemaEntries, modeEntries, gratitudeEntries]);

  const filtered = filter === 'all' ? allEntries : allEntries.filter(e => e._type === filter);

  // Group by date
  const grouped = useMemo(() => {
    const m = new Map<string, AnyEntry[]>();
    for (const e of filtered) {
      if (!m.has(e.dateKey)) m.set(e.dateKey, []);
      m.get(e.dateKey)!.push(e);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const counts = {
    all: allEntries.length,
    schema: schemaEntries.length,
    mode: modeEntries.length,
    gratitude: gratitudeEntries.length,
  };

  const QUICK_ADD = [
    { type: 'schema'    as DiaryType, color: 'var(--c-rose)',  eyebrow: 'Дневник схем',    title: 'Записать момент',  desc: 'Триггер · чувства · мысли · схема · здоровый взгляд', foot: '8–15 мин' },
    { type: 'mode'      as DiaryType, color: 'var(--c-slate)', eyebrow: 'Дневник режимов', title: 'Записать режим',   desc: 'Кто взял управление, что включило, что было нужно',   foot: '5–10 мин' },
    { type: 'gratitude' as DiaryType, color: 'var(--c-moss)',  eyebrow: 'Благодарность',   title: 'Три вещи',        desc: 'За что есть благодарность сегодня. Даже самое маленькое',    foot: '2–5 мин' },
  ];

  // Мета для карточки шаринга «сводка дневника» (DiaryShareButton) — только
  // для конкретного типа (эмодзи/цвет/заголовок), не для «Все» (там нет
  // единого визуального языка на одну карточку).
  const SHARE_META: Record<DiaryType, { emoji: string; title: string; color: string; entries: { createdAt: string }[] }> = {
    schema:    { emoji: '📓', title: 'Дневник схем',         color: 'var(--c-rose)',  entries: schemaEntries },
    mode:      { emoji: '🔄', title: 'Дневник режимов',      color: 'var(--c-slate)', entries: modeEntries },
    gratitude: { emoji: '🌱', title: 'Дневник благодарности', color: 'var(--c-moss)', entries: gratitudeEntries },
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',       label: 'Все' },
    { id: 'schema',    label: 'Схемы' },
    { id: 'mode',      label: 'Режимы' },
    { id: 'gratitude', label: 'Благодарность' },
  ];

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
    <div className="page-inner-wide">

        {loadFailed && <DiaryLoadFailedBanner onRetry={() => { void load(); }} />}
        {/* ── Hero ── */}
        <div className="diary-hero">
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              <span style={{ color: 'var(--accent)' }}>● </span>Дневник
            </div>
            <h1 className="hub-title" style={{ marginBottom: 10 }}>
              Дневник<br /><span className="it">наблюдений</span>
            </h1>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5 }}>
              {totalCount > 0
                ? `${totalCount} ${totalCount === 1 ? 'запись' : totalCount < 5 ? 'записи' : 'записей'} · ведётся непрерывно`
                : 'Пара минут на запись — через 3–5 записей виден паттерн'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexDirection: 'column', gap: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => setNewEntry('schema')}
              style={{ whiteSpace: 'nowrap' }}
            >
              + Новая запись
            </button>
            {totalCount > 0 && (
              <div className="diary-stats">
                <div>
                  <div className="diary-stat-num">{daysThisMonth}<span className="small">/{daysInMonth}</span></div>
                  <div className="diary-stat-label">Дней с записью</div>
                </div>
                {streak > 1 && (
                  <div>
                    <div className="diary-stat-num">{streak}</div>
                    <div className="diary-stat-label">Дней подряд</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick add ── */}
        <div className="eyebrow" style={{ marginBottom: 14 }}>Что записать сегодня</div>
        <div className="quick-add">
          {QUICK_ADD.map(card => (
            <div
              key={card.type}
              className="quick-add-card"
              style={{ '--qa-color': card.color } as React.CSSProperties}
              {...pressable(() => setNewEntry(card.type))}
            >
              <div className="qa-stripe" style={{ background: card.color }} />
              <div className="qa-eyebrow">
                <span className="dot" />
                {card.eyebrow}
              </div>
              <div className="qa-title">{card.title}</div>
              <div className="qa-desc">{card.desc}</div>
              <div className="qa-foot">
                <span style={{ color: 'var(--qa-color)', fontWeight: 600 }}>+ записать</span>
                <span style={{ marginLeft: 8, color: 'var(--text-ghost)' }}>{card.foot}</span>
                <span className="qa-arrow">›</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Draft banners ── */}
        {(['schema', 'mode', 'gratitude'] as DiaryType[]).map(type => {
          const colors: Record<DiaryType, string> = { schema: 'var(--c-rose)', mode: 'var(--c-slate)', gratitude: 'var(--c-moss)' };
          const titles: Record<DiaryType, string> = { schema: 'схема', mode: 'режим', gratitude: 'благодарность' };
          if (!loadDraft(type)) return null;
          return (
            <DraftBanner
              key={type + draftKey}
              type={type}
              color={colors[type]}
              title={titles[type]}
              onContinue={() => setNewEntry(type)}
              onDelete={() => { clearDraft(type); setDraftKey(k => k + 1); }}
            />
          );
        })}

        {/* ── Filters ── */}
        {totalCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="eyebrow">Архив · {totalCount}</span>
            {filter !== 'all' && <DiaryShareButton {...SHARE_META[filter]} />}
          </div>
        )}
        <div className="diary-filters">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={'diary-filter ' + (filter === f.id ? 'is-active' : '')}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="diary-filter-count">{counts[f.id]}</span>
            </button>
          ))}
          <span className="spacer" />
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-faint)' }}>
            Загрузка…
          </div>
        )}

        {/* ── Empty: для новичка отвечает «что это и зачем» ── */}
        {!loading && filtered.length === 0 && <DiaryEmptyExplainer filter={filter} />}

        {/* ── Timeline ── */}
        {!loading && grouped.map(([dateKey, entries]) => {
          const rel = dateRelLabel(dateKey);
          const entryCount = entries.length;
          return (
            <div key={dateKey} className="date-group">
              <div className="date-group-head">
                <span className="date-group-day">{fmtDayMonth(dateKey)}</span>
                <span className="date-group-rel">{rel ? `${rel} · ` : ''}{fmtWeekday(dateKey)}</span>
                <span className="date-group-count">{entryCount} {entryCount === 1 ? 'запись' : entryCount < 5 ? 'записи' : 'записей'}</span>
              </div>
              {entries.map(item => {
                if (item._type === 'schema') return (
                  <SchemaEntry key={'s-' + item.entry.id} entry={item.entry} onDelete={() => handleDelete('schema', item.entry.id)} />
                );
                if (item._type === 'mode') return (
                  <ModeEntry key={'m-' + item.entry.id} entry={item.entry} onDelete={() => handleDelete('mode', item.entry.id)} />
                );
                return (
                  <GratitudeEntry key={'g-' + item.entry.id} entry={item.entry} onDelete={() => handleDelete('gratitude', item.entry.id)} />
                );
              })}
            </div>
          );
        })}

    </div>
  );
}
