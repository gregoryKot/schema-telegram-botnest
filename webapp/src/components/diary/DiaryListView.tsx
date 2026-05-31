import { useState } from 'react';
import type { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, DiaryType } from '../../types';
import { EMOTIONS, getModeById, getSchemaById } from '../../schemaTherapyData';
import { loadDraft, clearDraft, formatDraftAge } from '../../utils/drafts';

const cm = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

interface Props {
  type: DiaryType;
  schemaEntries: SchemaDiaryEntry[];
  modeEntries: ModeDiaryEntry[];
  gratitudeEntries: GratitudeDiaryEntry[];
  onBack: () => void;
  onNewEntry: () => void;
  onDelete: (type: DiaryType, id: number) => void;
}

const DIARY_META: Record<DiaryType, { title: string; eyebrow: string; emoji: string; color: string; emptyLine1: string; emptyLine2: string; fabLabel: string }> = {
  schema:    { title: 'Дневник схем',          eyebrow: 'Дневник схем',     emoji: '📓', color: 'var(--c-rose)',   emptyLine1: 'Пока здесь тихо.', emptyLine2: 'Когда что-то триггернёт – возвращайся и записывай.', fabLabel: '+ Записать момент' },
  mode:      { title: 'Дневник режимов',       eyebrow: 'Дневник режимов',  emoji: '🔄', color: 'var(--c-slate)',  emptyLine1: 'Пока здесь тихо.', emptyLine2: 'Как только поймаешь себя в знакомом состоянии – приходи записать.', fabLabel: '+ Записать режим' },
  gratitude: { title: 'Дневник благодарности', eyebrow: 'Благодарность',    emoji: '🌱', color: 'var(--c-moss)',  emptyLine1: 'Пока здесь тихо.', emptyLine2: 'Начни сегодня – достаточно трёх вещей.', fabLabel: '+ Записать' },
};

function formatDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
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
  if (!confirm) {
    return <button onClick={() => setConfirm(true)} style={{ marginTop: 8, background: cm(color, 12), border: 'none', borderRadius: 8, padding: '6px 12px', color, fontSize: 12, cursor: 'pointer' }}>Удалить</button>;
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={onClick} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: cm('var(--c-rose)', 15), color: 'var(--c-rose)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Удалить навсегда</button>
      <button onClick={() => setConfirm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
    </div>
  );
}

function SchemaCard({ entry, color, onDelete }: { entry: SchemaDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const emotionMetas = EMOTIONS.filter(e => entry.emotions.some(em => em.id === e.id));
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, background: 'transparent' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{formatDt(entry.createdAt)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-ghost)' }}>{open ? '▲' : '▼'}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
          {entry.trigger.length > 100 && !open ? entry.trigger.slice(0, 100) + '…' : entry.trigger}
        </div>
        {!open && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {emotionMetas.slice(0, 3).map(e => <span key={e.id} style={{ fontSize: 12, color: 'var(--text-sub)' }}>{e.emoji}</span>)}
            {schemas.slice(0, 2).map(s => s && <span key={s.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: cm(color, 12), color }}>{s.name}</span>)}
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
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

function ModeCard({ entry, color, onDelete }: { entry: ModeDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const mode = getModeById(entry.modeId);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, background: 'transparent' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{formatDt(entry.createdAt)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-ghost)' }}>{open ? '▲' : '▼'}</span>
        </div>
        {mode && <div style={{ fontSize: 13, color, marginBottom: 4 }}>{mode.emoji} {mode.name}</div>}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
          {entry.situation.length > 100 && !open ? entry.situation.slice(0, 100) + '…' : entry.situation}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
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

function GratitudeCard({ entry, color, onDelete }: { entry: GratitudeDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, background: 'transparent' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {new Date(entry.date + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-ghost)' }}>{open ? '▲' : '▼'}</span>
        </div>
        {!open && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {entry.items.slice(0, 2).map((item, i) => (
              <span key={i} style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                {i > 0 && '· '}{item.length > 50 ? item.slice(0, 50) + '…' : item}
              </span>
            ))}
            {entry.items.length > 2 && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>+{entry.items.length - 2}</span>}
          </div>
        )}
        {open && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{entry.items.length} записи</div>}
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          {entry.items.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${color}`, lineHeight: 1.55 }}>{item}</div>
          ))}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

function DraftCard({ type, color, onContinue, onDelete }: { type: DiaryType; color: string; onContinue: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const draft = loadDraft<any>(type);
  if (!draft) return null;
  const preview = type === 'schema' ? draft.data?.trigger : type === 'mode' ? draft.data?.situation : draft.data?.items?.[0];
  return (
    <div style={{ borderRadius: 12, padding: '14px 16px', marginBottom: 14, background: cm(color, 5), border: `1px dashed ${cm(color, 30)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span className="eyebrow" style={{ padding: '3px 8px', borderRadius: 6, background: cm(color, 14), color }}>Черновик</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatDraftAge(draft.startedAt)}</span>
      </div>
      {preview && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10, lineHeight: 1.4 }}>{preview.length > 80 ? preview.slice(0, 80) + '…' : preview}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onContinue} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: color, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Продолжить</button>
        {!confirm
          ? <button onClick={() => setConfirm(true)} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>Удалить</button>
          : <button onClick={onDelete} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: cm('var(--c-rose)', 18), color: 'var(--c-rose)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Да, удалить</button>
        }
      </div>
    </div>
  );
}

export function DiaryListView({ type, schemaEntries, modeEntries, gratitudeEntries, onBack, onNewEntry, onDelete }: Props) {
  const meta = DIARY_META[type];
  const [draftKey, setDraftKey] = useState(0);
  const hasDraft = !!loadDraft(type);

  const totalCount = type === 'schema' ? schemaEntries.length : type === 'mode' ? modeEntries.length : gratitudeEntries.length;

  return (
    <div className="page-inner">
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 12 }}>
          ← Дневник
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              <span style={{ color: meta.color }}>● </span>
              {meta.eyebrow}
              {totalCount > 0 && <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 8 }}>{totalCount}</span>}
            </div>
            <h1 className="hub-title" style={{ marginBottom: 0 }}>
              {meta.title}
            </h1>
          </div>
          <button onClick={onNewEntry} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 14 }}>
            {meta.fabLabel}
          </button>
        </div>
      </div>

      {/* Max width for readability */}
      <div style={{ maxWidth: 680 }}>
        {hasDraft && (
          <DraftCard key={draftKey} type={type} color={meta.color} onContinue={onNewEntry} onDelete={() => { clearDraft(type); setDraftKey(k => k + 1); }} />
        )}

        {type === 'schema' && (
          schemaEntries.length === 0 && !hasDraft
            ? <Empty meta={meta} />
            : schemaEntries.map(e => <SchemaCard key={e.id} entry={e} color={meta.color} onDelete={() => onDelete('schema', e.id)} />)
        )}
        {type === 'mode' && (
          modeEntries.length === 0 && !hasDraft
            ? <Empty meta={meta} />
            : modeEntries.map(e => <ModeCard key={e.id} entry={e} color={meta.color} onDelete={() => onDelete('mode', e.id)} />)
        )}
        {type === 'gratitude' && (
          gratitudeEntries.length === 0 && !hasDraft
            ? <Empty meta={meta} />
            : gratitudeEntries.map(e => <GratitudeCard key={e.id} entry={e} color={meta.color} onDelete={() => onDelete('gratitude', e.id)} />)
        )}
      </div>
    </div>
  );
}

function Empty({ meta }: { meta: typeof DIARY_META[DiaryType] }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-faint)' }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-sub)', marginBottom: 6 }}>{meta.emptyLine1}</div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>{meta.emptyLine2}</div>
    </div>
  );
}
