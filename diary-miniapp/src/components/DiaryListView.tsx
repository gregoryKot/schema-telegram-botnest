import { useState, useRef } from 'react';
import { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, DiaryType } from '../types';
import { EMOTIONS, getModeById, getSchemaById } from '../diaryData';
import { haptic } from '../haptic';

interface Props {
  type: DiaryType;
  schemaEntries: SchemaDiaryEntry[];
  modeEntries: ModeDiaryEntry[];
  gratitudeEntries: GratitudeDiaryEntry[];
  onBack: () => void;
  onNewEntry: () => void;
  onDelete: (type: DiaryType, id: number) => void;
}

const DIARY_META: Record<DiaryType, { title: string; emoji: string; color: string; emptyText: string; fabLabel: string }> = {
  schema:    { title: 'Дневник схем',          emoji: '📓', color: '#f87171', emptyText: 'Здесь будут твои наблюдения.\nКогда заметишь, что схема включилась — открой и запиши момент.', fabLabel: '+ Записать момент' },
  mode:      { title: 'Дневник режимов',       emoji: '🔄', color: '#60a5fa', emptyText: 'Здесь будут твои записи о режимах.\nКак только поймёшь, что какой-то режим взял управление — зафиксируй это.', fabLabel: '+ Записать режим' },
  gratitude: { title: 'Дневник благодарности', emoji: '🌱', color: '#34d399', emptyText: 'Здесь будут твои дни благодарности.\nНачни сегодня — три вещи, большие или маленькие.', fabLabel: '+ Записать день' },
};

function formatDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function DeleteBtn({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button onClick={() => { haptic.warning(); onClick(); }} className="sel-btn" style={{ marginTop: 8, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 8, padding: '6px 12px', color, fontSize: 12, cursor: 'pointer' }}>
      Удалить эту запись
    </button>
  );
}

function SchemaCard({ entry, color, onDelete }: { entry: SchemaDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const emotionMetas = EMOTIONS.filter(e => entry.emotions.some(em => em.id === e.id));
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);

  return (
    <div className="card" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, marginBottom: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ cursor: 'pointer', padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => { haptic.tap(); setOpen(o => !o); }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 5, letterSpacing: '0.02em' }}>{formatDt(entry.createdAt)}</div>
          <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.45 }}>{entry.trigger.slice(0, 80)}{entry.trigger.length > 80 ? '…' : ''}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {emotionMetas.map(em => <span key={em.id} style={{ fontSize: 14 }}>{em.emoji}</span>)}
            {schemas.slice(0, 2).map(s => s && (
              <span key={s.id} style={{ fontSize: 11, background: `${s.domainColor}1a`, color: s.domainColor, borderRadius: 8, padding: '2px 8px', fontWeight: 500 }}>{s.name}</span>
            ))}
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 14, marginTop: 2 }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ paddingTop: 12 }}>
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
        </div>
      )}
    </div>
  );
}

function ModeCard({ entry, color, onDelete }: { entry: ModeDiaryEntry; color: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const mode = getModeById(entry.modeId);

  return (
    <div className="card" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, marginBottom: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ cursor: 'pointer', padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => { haptic.tap(); setOpen(o => !o); }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 5, letterSpacing: '0.02em' }}>{formatDt(entry.createdAt)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{mode?.emoji ?? '🔄'}</span>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{mode?.name ?? entry.modeId}</div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)' }}>{entry.situation.slice(0, 70)}{entry.situation.length > 70 ? '…' : ''}</div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 14, marginTop: 2 }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ paddingTop: 12 }}>
            <Field label="Ситуация" text={entry.situation} />
            {entry.thoughts && <Field label="Мысли" text={entry.thoughts} />}
            {entry.feelings && <Field label="Чувства" text={entry.feelings} />}
            {entry.bodyFeelings && <Field label="Тело" text={entry.bodyFeelings} />}
            {entry.actions && <Field label="Действия" text={entry.actions} />}
            {entry.actualNeed && <Field label="Что на самом деле было нужно" text={entry.actualNeed} />}
            {entry.childhoodMemories && <Field label="Детские воспоминания" text={entry.childhoodMemories} />}
            <DeleteBtn color={color} onClick={onDelete} />
          </div>
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
    <div className="card" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, marginBottom: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ cursor: 'pointer', padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => { haptic.tap(); setOpen(o => !o); }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 5, letterSpacing: '0.02em' }}>{dateStr}</div>
          {entry.items.slice(0, 2).map((it, i) => (
            <div key={i} style={{ fontSize: 14, color: '#fff', lineHeight: 1.45, marginBottom: 2 }}>🌱 {it.slice(0, 55)}{it.length > 55 ? '…' : ''}</div>
          ))}
          {entry.items.length > 2 && <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: 12, marginTop: 3 }}>+ ещё {entry.items.length - 2}</div>}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 14, marginTop: 2 }}>{open ? '∧' : '∨'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ paddingTop: 12 }}>
            {entry.items.map((it, i) => (
              <div key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', marginBottom: 6, lineHeight: 1.5 }}>🌱 {it}</div>
            ))}
            <DeleteBtn color={color} onClick={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  const [line1, line2] = text.split('\n');
  return (
    <div style={{ textAlign: 'center', padding: '80px 32px 60px', color: 'rgba(255,255,255,0.32)', fontSize: 14, lineHeight: 1.7 }}>
      <div style={{ fontSize: 42, marginBottom: 16, opacity: 0.45 }}>📭</div>
      <div style={{ fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{line1}</div>
      {line2 && <div style={{ fontSize: 13 }}>{line2}</div>}
    </div>
  );
}

export function DiaryListView({ type, schemaEntries, modeEntries, gratitudeEntries, onBack, onNewEntry, onDelete }: Props) {
  const meta = DIARY_META[type];
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t.clientX < 40) touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = Math.abs(t.clientY - touchStart.current.y);
    touchStart.current = null;
    if (dx > 72 && dy < 50) { haptic.tap(); onBack(); }
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ minHeight: '100vh', background: '#0d0f18', animation: 'slide-in-right 250ms ease' }}
    >
      {/* Sticky header with top color accent */}
      <div style={{ position: 'sticky', top: 0, background: '#0d0f18', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${meta.color} 0%, transparent 65%)`, opacity: 0.65 }} />
        <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { haptic.tap(); onBack(); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ‹
          </button>
          <span style={{ fontSize: 20 }}>{meta.emoji}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{meta.title}</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 100px' }}>
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

      <button onClick={() => { haptic.tap(); onNewEntry(); }} style={{
        position: 'fixed', bottom: 28, right: 20,
        background: meta.color, border: 'none', borderRadius: 22,
        padding: '14px 22px', color: type === 'gratitude' ? '#0d0f18' : '#fff',
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        boxShadow: `0 6px 28px ${meta.color}55`,
        WebkitTapHighlightColor: 'transparent',
      }}>
        {meta.fabLabel}
      </button>
    </div>
  );
}
