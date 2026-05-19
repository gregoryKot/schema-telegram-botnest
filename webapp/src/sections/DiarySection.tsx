import { useCallback, useEffect, useState } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../types';
import { api } from '../api';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { EMOTIONS, getModeById, getSchemaById } from '../schemaTherapyData';
import type { EmotionEntry } from '../types';
import { loadDraft, clearDraft, formatDraftAge } from '../utils/drafts';

const TODAY = new Date().toISOString().split('T')[0];

// ─── helpers ──────────────────────────────────────────────────────────────────

const cm = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

function fmtDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="eyebrow" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

function DeleteBtn({ color, onClick }: { color: string; onClick: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return (
    <button onClick={() => setConfirm(true)} style={{ marginTop: 8, background: cm(color, 12), border: 'none', borderRadius: 8, padding: '6px 12px', color, fontSize: 12, cursor: 'pointer' }}>
      Удалить
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={onClick} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: cm('var(--c-rose)', 15), color: 'var(--c-rose)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Удалить навсегда</button>
      <button onClick={() => setConfirm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
    </div>
  );
}

// ─── Schema entry card ────────────────────────────────────────────────────────

function SchemaCard({ entry, onDelete }: { entry: SchemaDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-rose)';
  const emotionMetas = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Схема</span>
              {schemas.length > 0 && <span style={{ fontSize: 12, color, padding: '1px 8px', borderRadius: 8, background: cm(color, 10) }}>{schemas[0]?.name}</span>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, paddingLeft: 11 }}>
              {entry.trigger.length > 120 && !open ? entry.trigger.slice(0, 120) + '…' : entry.trigger}
            </div>
            {!open && emotionMetas.length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 5, paddingLeft: 11 }}>
                {emotionMetas.slice(0, 4).map(e => <span key={e.id} style={{ fontSize: 12, color: 'var(--text-sub)' }}>{e.emoji} {e.label}</span>)}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtDt(entry.createdAt)}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingLeft: 11 }}>
          {emotionMetas.length > 0 && <Field label="Чувства" text={emotionMetas.map(e => `${e.emoji} ${e.label}`).join(', ')} />}
          {entry.thoughts && <Field label="Мысли" text={entry.thoughts} />}
          {entry.bodyFeelings && <Field label="Тело" text={entry.bodyFeelings} />}
          {entry.actualBehavior && <Field label="Поведение" text={entry.actualBehavior} />}
          {schemas.length > 0 && <Field label="Схемы" text={schemas.map(s => s?.name).join(', ')} />}
          {entry.schemaOrigin && <Field label="Происхождение" text={entry.schemaOrigin} />}
          {entry.healthyView && <Field label="Здоровый взгляд" text={entry.healthyView} />}
          {entry.realProblems && <Field label="Реальные проблемы" text={entry.realProblems} />}
          {entry.excessiveReactions && <Field label="Чрезмерные реакции" text={entry.excessiveReactions} />}
          {entry.healthyBehavior && <Field label="Здоровое поведение" text={entry.healthyBehavior} />}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

// ─── Mode entry card ──────────────────────────────────────────────────────────

function ModeCard({ entry, onDelete }: { entry: ModeDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-slate)';
  const mode = getModeById(entry.modeId);
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Режим</span>
              {mode && <span style={{ fontSize: 12, color, padding: '1px 8px', borderRadius: 8, background: cm(color, 10) }}>{mode.emoji} {mode.name}</span>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, paddingLeft: 11 }}>
              {entry.situation.length > 120 && !open ? entry.situation.slice(0, 120) + '…' : entry.situation}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtDt(entry.createdAt)}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingLeft: 11 }}>
          {entry.thoughts && <Field label="Мысли" text={entry.thoughts} />}
          {entry.feelings && <Field label="Чувства" text={entry.feelings} />}
          {entry.bodyFeelings && <Field label="Тело" text={entry.bodyFeelings} />}
          {entry.actions && <Field label="Действия" text={entry.actions} />}
          {entry.actualNeed && <Field label="Что было нужно" text={entry.actualNeed} />}
          {entry.childhoodMemories && <Field label="Воспоминания" text={entry.childhoodMemories} />}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

// ─── Gratitude entry card ─────────────────────────────────────────────────────

function GratitudeCard({ entry, onDelete }: { entry: GratitudeDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-moss)';
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Благодарность</span>
              <span style={{ fontSize: 12, color, padding: '1px 8px', borderRadius: 8, background: cm(color, 10) }}>{entry.items.length} пункта</span>
            </div>
            {!open && (
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, paddingLeft: 11 }}>
                {entry.items[0]}{entry.items.length > 1 && <span style={{ color: 'var(--text-faint)' }}> · +{entry.items.length - 1}</span>}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtDate(entry.date)}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingLeft: 11 }}>
          {entry.items.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${color}`, lineHeight: 1.55 }}>{item}</div>
          ))}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

// ─── Draft banner ─────────────────────────────────────────────────────────────

function DraftBanner({ type, color, onContinue, onDelete }: { type: DiaryType; color: string; onContinue: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const draft = loadDraft<Record<string, unknown>>(type);
  if (!draft) return null;
  const preview = type === 'schema' ? (draft.data as Record<string, string>)?.trigger
    : type === 'mode' ? (draft.data as Record<string, string>)?.situation
    : (draft.data as Record<string, string[]>)?.items?.[0];
  return (
    <div style={{ borderRadius: 10, padding: '14px 16px', marginBottom: 16, background: cm(color, 5), border: `1px dashed ${cm(color, 30)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className="eyebrow" style={{ padding: '2px 7px', borderRadius: 5, background: cm(color, 14), color }}>Черновик</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatDraftAge(draft.startedAt)}</span>
      </div>
      {preview && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10, lineHeight: 1.4 }}>{String(preview).slice(0, 90)}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onContinue} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: color, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Продолжить</button>
        {!confirm
          ? <button onClick={() => setConfirm(true)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>Удалить</button>
          : <button onClick={onDelete} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: cm('var(--c-rose)', 18), color: 'var(--c-rose)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Удалить</button>
        }
      </div>
    </div>
  );
}

// ─── Unified sorted item ──────────────────────────────────────────────────────

type AnyEntry =
  | { _type: 'schema'; sortKey: string; entry: SchemaDiaryEntry }
  | { _type: 'mode';   sortKey: string; entry: ModeDiaryEntry   }
  | { _type: 'gratitude'; sortKey: string; entry: GratitudeDiaryEntry };

// ─── Main component ───────────────────────────────────────────────────────────

type Filter = 'all' | DiaryType;

export function DiarySection({ onClose }: { onClose?: () => void } = {}) {
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

  const handleDelete = async (type: DiaryType, id: number) => {
    if (type === 'schema')    { await api.deleteSchemaDiary(id);    setSchemaEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'mode')      { await api.deleteModeDiary(id);      setModeEntries(p => p.filter(e => e.id !== id)); }
    if (type === 'gratitude') { await api.deleteGratitudeDiary(id); setGratitudeEntries(p => p.filter(e => e.id !== id)); }
  };

  // Build unified sorted archive
  const allEntries: AnyEntry[] = [
    ...schemaEntries.map(e => ({ _type: 'schema' as const, sortKey: e.createdAt, entry: e })),
    ...modeEntries.map(e =>   ({ _type: 'mode'   as const, sortKey: e.createdAt, entry: e })),
    ...gratitudeEntries.map(e => ({ _type: 'gratitude' as const, sortKey: e.date + 'T12:00:00', entry: e })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const filtered = filter === 'all' ? allEntries : allEntries.filter(e => e._type === filter);
  const totalCount = schemaEntries.length + modeEntries.length + gratitudeEntries.length;

  const CARDS = [
    { type: 'schema'    as DiaryType, title: 'Дневник схем',          sub: 'Триггер · чувства · мысли · реальность · поведение', color: 'var(--c-rose)'  },
    { type: 'mode'      as DiaryType, title: 'Дневник режимов',       sub: 'Что включило режим, как удалось переключиться',       color: 'var(--c-slate)' },
    { type: 'gratitude' as DiaryType, title: 'Благодарность',         sub: '3 вещи, за которые благодарен сегодня',               color: 'var(--c-moss)'  },
  ] as const;

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',       label: 'Все' },
    { id: 'schema',    label: 'Схемы' },
    { id: 'mode',      label: 'Режимы' },
    { id: 'gratitude', label: 'Благодарность' },
  ];

  return (
    <div className="page-inner-wide">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>Дневник</h1>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {loading ? 'Загрузка…' : totalCount === 0 ? 'Фиксируй паттерны, замечай прогресс' : `${totalCount} ${totalCount === 1 ? 'запись' : totalCount < 5 ? 'записи' : 'записей'} · ведётся непрерывно`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setNewEntry('schema')} className="btn btn-primary">
            + Новая запись
          </button>
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary">Закрыть</button>
          )}
        </div>
      </div>

      {/* ── "Что записать сегодня" 3-col grid ── */}
      <div className="section">
        <div className="eyebrow" style={{ marginBottom: 20 }}>Что записать сегодня</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {CARDS.map(card => (
            <div
              key={card.type}
              onClick={() => setNewEntry(card.type)}
              style={{ cursor: 'pointer', padding: '20px 0', borderTop: `2px solid ${card.color}` }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{card.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8, lineHeight: 1.55, maxWidth: 280 }}>{card.sub}</div>
              <span className="link" style={{ marginTop: 14, display: 'inline-block', fontSize: 13 }}>+ записать →</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Archive ── */}
      <div className="section">
        {/* Filter row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span className="eyebrow">Архив · {totalCount}</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  fontSize: 12.5, fontWeight: filter === f.id ? 600 : 500,
                  background: filter === f.id ? 'var(--surface-3)' : 'transparent',
                  color: filter === f.id ? 'var(--text)' : 'var(--text-faint)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Draft banners */}
        {(['schema', 'mode', 'gratitude'] as DiaryType[]).map(type => {
          const colors: Record<DiaryType, string> = { schema: 'var(--c-rose)', mode: 'var(--c-slate)', gratitude: 'var(--c-moss)' };
          if (!loadDraft(type)) return null;
          if (filter !== 'all' && filter !== type) return null;
          return (
            <DraftBanner
              key={type + draftKey}
              type={type}
              color={colors[type]}
              onContinue={() => setNewEntry(type)}
              onDelete={() => { clearDraft(type); setDraftKey(k => k + 1); }}
            />
          );
        })}

        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-faint)' }}>
            Загрузка…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.35 }}>📭</div>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 5 }}>Пока здесь тихо</div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {filter === 'all' ? 'Начни с "Что записать сегодня" выше' : 'Нет записей этого типа'}
            </div>
          </div>
        )}

        {!loading && filtered.map(item => {
          if (item._type === 'schema') return (
            <SchemaCard key={'s-' + item.entry.id} entry={item.entry} onDelete={() => handleDelete('schema', item.entry.id)} />
          );
          if (item._type === 'mode') return (
            <ModeCard key={'m-' + item.entry.id} entry={item.entry} onDelete={() => handleDelete('mode', item.entry.id)} />
          );
          return (
            <GratitudeCard key={'g-' + item.entry.id} entry={item.entry} onDelete={() => handleDelete('gratitude', item.entry.id)} />
          );
        })}
      </div>

      {/* ── Entry creation overlays ── */}
      {newEntry === 'schema' && (
        <SchemaEntrySheet
          activeSchemaIds={activeSchemaIds}
          onClose={() => setNewEntry(null)}
          onSave={async (data) => {
            const entry = await api.createSchemaDiary(data);
            setSchemaEntries(prev => [entry, ...prev]);
            setNewEntry(null);
          }}
        />
      )}
      {newEntry === 'mode' && (
        <ModeEntrySheet
          onClose={() => setNewEntry(null)}
          onSave={async (data) => {
            const entry = await api.createModeDiary(data);
            setModeEntries(prev => [entry, ...prev]);
            setNewEntry(null);
          }}
        />
      )}
      {newEntry === 'gratitude' && (
        <GratitudeEntrySheet
          onClose={() => setNewEntry(null)}
          date={TODAY}
          existingItems={todayGratitude?.items}
          onSave={async (date, items) => {
            const entry = await api.createGratitudeDiary(date, items);
            setGratitudeEntries(prev => {
              const filtered = prev.filter(e => e.date !== date);
              return [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
            });
            setNewEntry(null);
          }}
        />
      )}
    </div>
  );
}
