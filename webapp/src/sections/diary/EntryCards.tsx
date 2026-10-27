import { useState, type ReactNode } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, EmotionEntry } from '../../types';
import { pressable } from '../../utils/a11y';
import { EMOTIONS, getModeById, getSchemaById } from '../../schemaTherapyData';
import { ModeEntryShare } from '../../components/diary/ModeEntryShare';
import { GratitudeShare } from '../../components/diary/GratitudeShare';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { fmtTime, fmtDateKey, fmtDayMonth } from './dateHelpers';
import { schemaEntryRows, modeEntryRows, type FieldRow } from './entryRows';
import '../../styles/client-diary.css';

// Карточки записей дневника: бейдж типа в тоне DIARY_HUE, заголовок, текст; клик раскрывает детали и удаление.

export function DeleteBtn({ onClick }: { onClick: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return (
    <button className="ds-btn ds-btn--sm ds-btn--secondary cd-del" onClick={e => { e.stopPropagation(); setConfirm(true); }}>Удалить</button>
  );
  return (
    <div className="cd-del-row" role="presentation" onClick={e => e.stopPropagation()}>
      <button className="ds-btn ds-btn--sm ds-btn--accent" onClick={onClick}>Удалить навсегда</button>
      <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setConfirm(false)}>Отмена</button>
    </div>
  );
}

export function ExpandField({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className="cd-field">
      <div className={'cd-field-label' + (accent ? ' is-accent' : '')}>{label}</div>
      <div className="cd-field-text">{text}</div>
    </div>
  );
}

const TYPE_LABEL: Record<DiaryType, string> = { schema: 'Схема', mode: 'Режим', gratitude: 'Благодарность' };

function EntryShell({ type, label, title, time, preview, children }: {
  type: DiaryType; label?: string; title?: string; time?: string; preview: ReactNode; children?: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-card ds-card--row ds-card--hover cd-entry" style={hueStyle(DIARY_HUE[type])} aria-expanded={open} {...pressable(() => setOpen(v => !v))}>
      <div className="cd-entry-head">
        <span className="ds-chip ds-chip--sm tone-tint">{label ?? TYPE_LABEL[type]}</span>
        {title && <span className="cd-entry-title">{title}</span>}
        {time && <span className="cd-entry-time">{time}</span>}
      </div>
      <div className="cd-entry-text">{preview}</div>
      {children?.(open)}
    </div>
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
function ExpandFields({ rows }: { rows: FieldRow[] }) {
  return <>{rows.filter(([, text]) => text).map(([label, text, accent]) => (
    <ExpandField key={label} label={label} text={text!} accent={accent} />
  ))}</>;
}

export function SchemaEntry({ entry, onDelete }: { entry: SchemaDiaryEntry; onDelete: () => void }) {
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  const emotions = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));
  const thought = schemas.length === 0 && entry.emotions.length === 0; // «Дневник одной страницей»: просто мысль
  return (
    <EntryShell
      type="schema"
      label={thought ? 'Мысль' : undefined}
      title={schemas.length > 0 ? schemas.slice(0, 2).map(s => s!.name).join(' · ') : thought ? undefined : 'Дневник схем'}
      time={fmtTime(entry.createdAt)}
      preview={<>
        {entry.trigger}
        {emotions.length > 0 && <div className="cd-entry-meta">{emotions.slice(0, 4).map(e => e.label).join(' · ')}</div>}
      </>}
    >
      {open => open && (
        <div className="cd-entry-more" role="presentation" onClick={stop}>
          <ExpandFields rows={schemaEntryRows(entry)} />
          <DeleteBtn onClick={onDelete} />
        </div>
      )}
    </EntryShell>
  );
}

export function ModeEntry({ entry, onDelete }: { entry: ModeDiaryEntry; onDelete: () => void }) {
  const mode = getModeById(entry.modeId);
  return (
    <EntryShell
      type="mode"
      label={entry.fromCase ? 'Разбор' : undefined}
      title={mode ? mode.name : 'Дневник режимов'}
      time={fmtTime(entry.createdAt)}
      preview={entry.situation}
    >
      {open => open ? (
        <div className="cd-entry-more" role="presentation" onClick={stop}>
          <ExpandFields rows={modeEntryRows(entry)} />
          <DeleteBtn onClick={onDelete} />
          <ModeEntryShare
            mode={mode}
            healthyResponse={entry.healthyResponse}
            entry={entry}
            dateLabel={fmtDayMonth(fmtDateKey(entry.createdAt))}
          />
        </div>
      ) : entry.actualNeed && (
        <div className="cd-entry-meta">что было нужно › {entry.actualNeed.slice(0, 80)}</div>
      )}
    </EntryShell>
  );
}

export function GratitudeEntry({ entry, onDelete }: { entry: GratitudeDiaryEntry; onDelete: () => void }) {
  const n = entry.items.length;
  return (
    <EntryShell
      type="gratitude"
      title={`${n} ${n === 1 ? 'пункт' : n < 5 ? 'пункта' : 'пунктов'}`}
      preview={null}
    >
      {open => (
        <>
          <ul className="cd-grat">
            {(open ? entry.items : entry.items.slice(0, 2)).map((item, i) => (
              <li key={i}><span className="cd-grat-num">{String(i + 1).padStart(2, '0')}</span>{item}</li>
            ))}
            {!open && n > 2 && <li className="cd-grat-more"><span className="cd-grat-num">···</span>ещё {n - 2}</li>}
          </ul>
          {open && (
            <div className="cd-entry-more" role="presentation" onClick={stop}>
              <DeleteBtn onClick={onDelete} />
              <GratitudeShare items={entry.items} dateLabel={fmtDayMonth(entry.date)} />
            </div>
          )}
        </>
      )}
    </EntryShell>
  );
}
