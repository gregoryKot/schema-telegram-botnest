import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../types';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { EMOTIONS, getModeById, getSchemaById } from '../schemaTherapyData';
import type { EmotionEntry } from '../types';
import { loadDraft, clearDraft, formatDraftAge } from '../utils/drafts';

const TODAY = new Date().toISOString().split('T')[0];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateKey(iso: string) {
  return iso.slice(0, 10);
}
function fmtDayMonth(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${day} ${months[d.getMonth()]}`;
}
function fmtWeekday(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'][d.getDay()];
}
function dateRelLabel(dateStr: string) {
  const today = new Date(TODAY + 'T12:00:00');
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  return null;
}

// ─── Delete button ────────────────────────────────────────────────────────────

function DeleteBtn({ color, onClick }: { color: string; onClick: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return (
    <button onClick={e => { e.stopPropagation(); setConfirm(true); }} style={{
      marginTop: 12, background: color + '18', border: 'none', borderRadius: 8,
      padding: '6px 12px', color, fontSize: 12, cursor: 'pointer',
    }}>Удалить</button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
      <button onClick={onClick} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--c-rose)18', color: 'var(--c-rose)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Удалить навсегда</button>
      <button onClick={() => setConfirm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
    </div>
  );
}

// ─── Entry card (schema) ──────────────────────────────────────────────────────

function SchemaEntry({ entry, onDelete }: { entry: SchemaDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-rose)';
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  const emotionMetas = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));

  return (
    <div className="entry" style={{ '--entry-color': color } as React.CSSProperties} onClick={() => setOpen(v => !v)}>
      <span className="entry-time">{fmtTime(entry.createdAt)}</span>
      <span className="entry-rule" />
      <div className="entry-body">
        <div className="entry-eyebrow">
          <span className="dot" />
          Дневник схем
          {schemas.length > 0 && (
            <span className="entry-tags">
              {schemas.slice(0, 2).map(s => (
                <span key={s!.id} className="entry-tag">{s!.name}</span>
              ))}
            </span>
          )}
        </div>
        <div className="entry-text">{entry.trigger}</div>
        {emotionMetas.length > 0 && (
          <div className="entry-meta">
            {emotionMetas.slice(0, 4).map(e => (
              <span key={e.id} className="emo">
                <span className="emo-dot" style={{ background: 'var(--c-rose)' }} />
                <span style={{ color: 'var(--text-sub)' }}>{e.label}</span>
              </span>
            ))}
          </div>
        )}
        {open && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
            {entry.thoughts && <ExpandField label="Мысли" text={entry.thoughts} />}
            {entry.bodyFeelings && <ExpandField label="Тело" text={entry.bodyFeelings} />}
            {entry.actualBehavior && <ExpandField label="Реакция" text={entry.actualBehavior} />}
            {entry.healthyView && <ExpandField label="Здоровый взгляд" text={entry.healthyView} color="var(--accent)" />}
            <DeleteBtn color="var(--c-rose)" onClick={onDelete} />
          </div>
        )}
      </div>
      <span className="entry-cta">›</span>
    </div>
  );
}

// ─── Entry card (mode) ────────────────────────────────────────────────────────

function ModeEntry({ entry, onDelete }: { entry: ModeDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-slate)';
  const mode = getModeById(entry.modeId);

  return (
    <div className="entry" style={{ '--entry-color': color } as React.CSSProperties} onClick={() => setOpen(v => !v)}>
      <span className="entry-time">{fmtTime(entry.createdAt)}</span>
      <span className="entry-rule" />
      <div className="entry-body">
        <div className="entry-eyebrow">
          <span className="dot" />
          Дневник режимов
          {mode && (
            <span className="entry-tags">
              <span className="entry-tag">{mode.name}</span>
            </span>
          )}
        </div>
        <div className="entry-text">{entry.situation}</div>
        {entry.actualNeed && !open && (
          <div className="entry-meta">
            <span style={{ color: 'var(--text-faint)' }}>что было нужно ›</span>
            <span style={{ color: 'var(--text-sub)' }}>{entry.actualNeed.slice(0, 80)}</span>
          </div>
        )}
        {open && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
            {entry.thoughts && <ExpandField label="Мысли режима" text={entry.thoughts} />}
            {entry.feelings && <ExpandField label="Чувства" text={entry.feelings} />}
            {entry.actualNeed && <ExpandField label="Что было нужно" text={entry.actualNeed} color="var(--accent)" />}
            {entry.childhoodMemories && <ExpandField label="Откуда знакомо" text={entry.childhoodMemories} />}
            <DeleteBtn color="var(--c-slate)" onClick={onDelete} />
          </div>
        )}
      </div>
      <span className="entry-cta">›</span>
    </div>
  );
}

// ─── Entry card (gratitude) ───────────────────────────────────────────────────

function GratitudeEntry({ entry, onDelete }: { entry: GratitudeDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-moss)';

  return (
    <div className="entry" style={{ '--entry-color': color } as React.CSSProperties} onClick={() => setOpen(v => !v)}>
      <span className="entry-time" style={{ fontStyle: 'italic' }}>·</span>
      <span className="entry-rule" />
      <div className="entry-body">
        <div className="entry-eyebrow">
          <span className="dot" />
          Благодарность
          <span className="entry-tags">
            <span className="entry-tag">{entry.items.length} {entry.items.length === 1 ? 'пункт' : entry.items.length < 5 ? 'пункта' : 'пунктов'}</span>
          </span>
        </div>
        <ul className="entry-grat-list">
          {(open ? entry.items : entry.items.slice(0, 2)).map((item, i) => (
            <li key={i}>
              <span className="grat-num">{String(i + 1).padStart(2, '0')}</span>
              {item}
            </li>
          ))}
          {!open && entry.items.length > 2 && (
            <li style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>
              <span className="grat-num">···</span>ещё {entry.items.length - 2}
            </li>
          )}
        </ul>
        {open && (
          <div onClick={e => e.stopPropagation()}>
            <DeleteBtn color="var(--c-moss)" onClick={onDelete} />
          </div>
        )}
      </div>
      <span className="entry-cta">›</span>
    </div>
  );
}

function ExpandField({ label, text, color }: { label: string; text: string; color?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: color ?? 'var(--text-faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

// ─── Draft banner ─────────────────────────────────────────────────────────────

function DraftBanner({ type, color, title, onContinue, onDelete }: {
  type: DiaryType; color: string; title: string;
  onContinue: () => void; onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const draft = loadDraft<Record<string, unknown>>(type);
  if (!draft) return null;
  const preview = type === 'schema' ? (draft.data as Record<string, string>)?.trigger
    : type === 'mode' ? (draft.data as Record<string, string>)?.situation
    : (draft.data as Record<string, string[]>)?.items?.[0];
  return (
    <div style={{ borderRadius: 10, padding: '12px 14px 12px 0', marginBottom: 10, display: 'flex', alignItems: 'stretch', gap: 0, background: `color-mix(in srgb, ${color} 6%, var(--bg))`, border: `1px solid color-mix(in srgb, ${color} 20%, var(--line))` }}>
      {/* Colored left stripe */}
      <div style={{ width: 3, borderRadius: '10px 0 0 10px', background: color, flexShrink: 0, marginRight: 14 }} />
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>Черновик</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{title} · {formatDraftAge(draft.startedAt)}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onContinue} style={{ fontSize: 12.5, fontWeight: 700, color, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', letterSpacing: '-0.01em' }}>Продолжить →</button>
          {!confirm
            ? <button onClick={() => setConfirm(true)} style={{ fontSize: 18, lineHeight: 1, color: 'var(--text-ghost)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
            : <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--c-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontWeight: 700 }}>удалить</button>
          }
        </div>
        {preview && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, lineHeight: 1.45, paddingRight: 8 }}>{String(preview).slice(0, 100)}</div>}
      </div>
    </div>
  );
}

// ─── Unified entry type ───────────────────────────────────────────────────────

type AnyEntry =
  | { _type: 'schema';    sortKey: string; dateKey: string; entry: SchemaDiaryEntry }
  | { _type: 'mode';      sortKey: string; dateKey: string; entry: ModeDiaryEntry }
  | { _type: 'gratitude'; sortKey: string; dateKey: string; entry: GratitudeDiaryEntry };

type Filter = 'all' | DiaryType;

// ─── Main component ───────────────────────────────────────────────────────────

export function DiarySection({ onClose: _onClose }: { onClose?: () => void } = {}) {
  const tr = useTr();
  const [schemaEntries,    setSchemaEntries]    = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries,      setModeEntries]      = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [activeSchemaIds,  setActiveSchemaIds]  = useState<string[] | undefined>(undefined);
  const [loading,          setLoading]          = useState(true);
  const [filter,           setFilter]           = useState<Filter>('all');
  const [newEntry,         setNewEntry]         = useState<DiaryType | null>(null);
  const [draftKey,         setDraftKey]         = useState(0);

  const load = useCallback(async () => {
    try {
      const [schema, mode, gratitude, profile] = await Promise.all([
        api.getSchemaDiary(),
        api.getModeDiary(),
        api.getGratitudeDiary(),
        api.getProfile().catch(() => null),
      ]);
      setSchemaEntries(schema);
      setModeEntries(mode);
      setGratitudeEntries(gratitude);
      if (profile) setActiveSchemaIds(profile.ysq.activeSchemaIds);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
                : 'Фиксируй паттерны, замечай прогресс'}
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
              onClick={() => setNewEntry(card.type)}
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

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-faint)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text-sub)', fontStyle: 'italic', marginBottom: 8 }}>Пусто.</div>
            <div style={{ fontSize: 14 }}>
              {filter === 'all' ? tr('Нажми на карточку выше, чтобы начать.', 'Нажмите на карточку выше, чтобы начать.') : 'Нет записей этого типа.'}
            </div>
          </div>
        )}

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
