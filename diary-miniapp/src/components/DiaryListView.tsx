import { useState } from 'react';
import { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, DiaryType } from '../types';
import { EMOTIONS, getModeById, getSchemaById } from '../diaryData';

interface Props {
  type: DiaryType;
  schemaEntries: SchemaDiaryEntry[];
  modeEntries: ModeDiaryEntry[];
  gratitudeEntries: GratitudeDiaryEntry[];
  onBack: () => void;
  onNewEntry: () => void;
  onDelete: (type: DiaryType, id: number) => void;
}

const DIARY_META: Record<DiaryType, { title: string; emoji: string; color: string; emptyText: string }> = {
  schema:    { title: 'Дневник схем',          emoji: '📓', color: '#f87171', emptyText: 'Ещё нет записей. Запиши момент, когда активировалась схема.' },
  mode:      { title: 'Дневник режимов',       emoji: '🔄', color: '#60a5fa', emptyText: 'Ещё нет записей. Зафиксируй режим, когда заметишь его.' },
  gratitude: { title: 'Дневник благодарности', emoji: '🌱', color: '#34d399', emptyText: 'Ещё нет записей. Начни с трёх вещей за сегодня.' },
};

function formatDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function DeleteBtn({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ marginTop: 8, background: `${color}22`, border: 'none', borderRadius: 8, padding: '6px 12px', color, fontSize: 12, cursor: 'pointer' }}>
      Удалить запись
    </button>
  );
}

function SchemaCard({ entry, color, onDelete }: { entry: SchemaDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const emotionMetas = EMOTIONS.filter(e => entry.emotions.some(em => em.id === e.id));
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{formatDt(entry.createdAt)}</div>
          <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.4 }}>{entry.trigger.slice(0, 80)}{entry.trigger.length > 80 ? '…' : ''}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {emotionMetas.map(em => <span key={em.id} style={{ fontSize: 14 }}>{em.emoji}</span>)}
            {schemas.slice(0, 2).map(s => s && (
              <span key={s.id} style={{ fontSize: 11, background: `${s.domainColor}22`, color: s.domainColor, borderRadius: 8, padding: '2px 7px' }}>{s.name}</span>
            ))}
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
          {entry.thoughts && <Field label="Мысли" text={entry.thoughts} />}
          {entry.bodyFeelings && <Field label="Тело" text={entry.bodyFeelings} />}
          {entry.actualBehavior && <Field label="Фактическое поведение" text={entry.actualBehavior} />}
          {entry.schemaOrigin && <Field label="Откуда схема" text={entry.schemaOrigin} />}
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
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{formatDt(entry.createdAt)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{mode?.emoji ?? '🔄'}</span>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{mode?.name ?? entry.modeId}</div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{entry.situation.slice(0, 70)}{entry.situation.length > 70 ? '…' : ''}</div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
          <Field label="Ситуация" text={entry.situation} />
          {entry.thoughts && <Field label="Мысли" text={entry.thoughts} />}
          {entry.feelings && <Field label="Чувства" text={entry.feelings} />}
          {entry.bodyFeelings && <Field label="Тело" text={entry.bodyFeelings} />}
          {entry.actions && <Field label="Действия" text={entry.actions} />}
          {entry.actualNeed && <Field label="Что на самом деле было нужно" text={entry.actualNeed} />}
          {entry.childhoodMemories && <Field label="Детские воспоминания" text={entry.childhoodMemories} />}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

function GratitudeCard({ entry, color, onDelete }: { entry: GratitudeDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const d = new Date(entry.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' });

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{dateStr}</div>
          {entry.items.slice(0, 2).map((it, i) => (
            <div key={i} style={{ fontSize: 14, color: '#fff', lineHeight: 1.4 }}>🌱 {it.slice(0, 55)}{it.length > 55 ? '…' : ''}</div>
          ))}
          {entry.items.length > 2 && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>+ ещё {entry.items.length - 2}</div>}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
          {entry.items.map((it, i) => (
            <div key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 6, lineHeight: 1.5 }}>🌱 {it}</div>
          ))}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: 1.6 }}>{text}</div>;
}

export function DiaryListView({ type, schemaEntries, modeEntries, gratitudeEntries, onBack, onNewEntry, onDelete }: Props) {
  const meta = DIARY_META[type];

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', animation: 'slide-in-right 250ms ease' }}>
      <div style={{ position: 'sticky', top: 0, background: '#0f1117', zIndex: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ‹
          </button>
          <span style={{ fontSize: 22 }}>{meta.emoji}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{meta.title}</span>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>
        {type === 'schema' && (
          schemaEntries.length === 0 ? <Empty text={meta.emptyText} /> :
            schemaEntries.map(e => <SchemaCard key={e.id} entry={e} color={meta.color} onDelete={() => onDelete('schema', e.id)} />)
        )}
        {type === 'mode' && (
          modeEntries.length === 0 ? <Empty text={meta.emptyText} /> :
            modeEntries.map(e => <ModeCard key={e.id} entry={e} color={meta.color} onDelete={() => onDelete('mode', e.id)} />)
        )}
        {type === 'gratitude' && (
          gratitudeEntries.length === 0 ? <Empty text={meta.emptyText} /> :
            gratitudeEntries.map(e => <GratitudeCard key={e.id} entry={e} color={meta.color} onDelete={() => onDelete('gratitude', e.id)} />)
        )}
      </div>

      <button onClick={onNewEntry} style={{
        position: 'fixed', bottom: 24, right: 20,
        background: meta.color, border: 'none', borderRadius: 20,
        padding: '14px 20px', color: type === 'gratitude' ? '#0f1117' : '#fff',
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        boxShadow: `0 4px 24px ${meta.color}66`,
      }}>
        + Новая запись
      </button>
    </div>
  );
}
