import { useState } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, EmotionEntry } from '../../types';
import { pressable } from '../../utils/a11y';
import { EMOTIONS, getModeById, getSchemaById } from '../../schemaTherapyData';
import { ModeEntryShare } from '../../components/diary/ModeEntryShare';
import { loadDraft, formatDraftAge } from '../../utils/drafts';
import { fmtTime, fmtDateKey, fmtDayMonth } from './dateHelpers';

// Карточки записей дневника (схема/режим/благодарность) + черновик-баннер.
// Вынесено из DiarySection.tsx (правило №10).
export function DeleteBtn({ color, onClick }: { color: string; onClick: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return (
    <button onClick={e => { e.stopPropagation(); setConfirm(true); }} style={{
      marginTop: 12, background: color + '18', border: 'none', borderRadius: 8,
      padding: '6px 12px', color, fontSize: 12, cursor: 'pointer',
    }}>Удалить</button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }} role="presentation" onClick={e => e.stopPropagation()}>
      <button onClick={onClick} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--c-rose)18', color: 'var(--c-rose)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Удалить навсегда</button>
      <button onClick={() => setConfirm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--surface-2)', color: 'var(--text-sub)', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
    </div>
  );
}

// ─── Entry card (schema) ──────────────────────────────────────────────────────

export function SchemaEntry({ entry, onDelete }: { entry: SchemaDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-rose)';
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  const emotionMetas = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));

  return (
    <div className="entry" style={{ '--entry-color': color } as React.CSSProperties} aria-expanded={open} {...pressable(() => setOpen(v => !v))}>
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
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} role="presentation" onClick={e => e.stopPropagation()}>
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

export function ModeEntry({ entry, onDelete }: { entry: ModeDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-slate)';
  const mode = getModeById(entry.modeId);

  return (
    <div className="entry" style={{ '--entry-color': color } as React.CSSProperties} aria-expanded={open} {...pressable(() => setOpen(v => !v))}>
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
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} role="presentation" onClick={e => e.stopPropagation()}>
            {entry.thoughts && <ExpandField label="Мысли режима" text={entry.thoughts} />}
            {entry.feelings && <ExpandField label="Чувства" text={entry.feelings} />}
            {entry.actualNeed && <ExpandField label="Что было нужно" text={entry.actualNeed} color="var(--accent)" />}
            {entry.childhoodMemories && <ExpandField label="Откуда знакомо" text={entry.childhoodMemories} />}
            {entry.healthyResponse && <ExpandField label="Здоровый Взрослый" text={entry.healthyResponse} color="var(--c-moss)" />}
            <DeleteBtn color="var(--c-slate)" onClick={onDelete} />
            <ModeEntryShare
              mode={mode}
              healthyResponse={entry.healthyResponse}
              entry={entry}
              dateLabel={fmtDayMonth(fmtDateKey(entry.createdAt))}
              color={color}
            />
          </div>
        )}
      </div>
      <span className="entry-cta">›</span>
    </div>
  );
}

// ─── Entry card (gratitude) ───────────────────────────────────────────────────

export function GratitudeEntry({ entry, onDelete }: { entry: GratitudeDiaryEntry; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const color = 'var(--c-moss)';

  return (
    <div className="entry" style={{ '--entry-color': color } as React.CSSProperties} aria-expanded={open} {...pressable(() => setOpen(v => !v))}>
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
          <div role="presentation" onClick={e => e.stopPropagation()}>
            <DeleteBtn color="var(--c-moss)" onClick={onDelete} />
          </div>
        )}
      </div>
      <span className="entry-cta">›</span>
    </div>
  );
}

export function ExpandField({ label, text, color }: { label: string; text: string; color?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: color ?? 'var(--text-faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

// ─── Draft banner ─────────────────────────────────────────────────────────────

export function DraftBanner({ type, color, title, onContinue, onDelete }: {
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
            ? <button onClick={() => setConfirm(true)} aria-label="Удалить черновик" style={{ fontSize: 18, lineHeight: 1, color: 'var(--text-ghost)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
            : <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--c-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontWeight: 700 }}>удалить</button>
          }
        </div>
        {preview && <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, lineHeight: 1.45, paddingRight: 8 }}>{String(preview).slice(0, 100)}</div>}
      </div>
    </div>
  );
}
