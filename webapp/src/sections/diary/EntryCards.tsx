import { useState, type ReactNode } from 'react';
import type { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, EmotionEntry } from '../../types';
import { pressable } from '../../utils/a11y';
import { EMOTIONS, getModeById, getSchemaById } from '../../schemaTherapyData';
import { ModeEntryShare } from '../../components/diary/ModeEntryShare';
import { GratitudeShare } from '../../components/diary/GratitudeShare';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { fmtTime, fmtDateKey, fmtDayMonth } from './dateHelpers';
import { schemaEntryRows, modeEntryRows, type FieldRow } from './entryRows';
import { EntryPreviewText } from './EntryPreviewText';
import { DeleteBtn } from './DeleteBtn';
import { modeEntryKind, schemaEntryKind, type EntryKind } from './entryKind';
import { EntryKindChip } from './EntryKindChip';
import '../../styles/client-diary.css';
// Карточки записей дневника: бейдж типа в тоне DIARY_HUE, заголовок, текст; клик раскрывает детали и удаление.

export function ExpandField({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className="cd-field">
      <div className={'cd-field-label' + (accent ? ' is-accent' : '')}>{label}</div>
      <div className="cd-field-text">{text}</div>
    </div>
  );
}

// type — тон карточки (дневник), kind — ярлык (общий с лентой «Сегодня»).
function EntryShell({ type, kind, title, time, text, preview, children }: {
  type: DiaryType; kind: EntryKind; title?: string; time?: string;
  /** Текст записи: длинный в закрытой карточке обрезается (EntryPreviewText). */
  text?: string | null;
  preview?: ReactNode; children?: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-card ds-card--row ds-card--hover cd-entry" style={hueStyle(DIARY_HUE[type])} aria-expanded={open} {...pressable(() => setOpen(v => !v))}>
      <div className="cd-entry-head">
        <EntryKindChip kind={kind} />
        {title && <span className="cd-entry-title">{title}</span>}
        {time && <span className="cd-entry-time">{time}</span>}
      </div>
      <div className="cd-entry-text">{text && <EntryPreviewText text={text} open={open} />}{preview}</div>
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

export function SchemaEntry({ entry, onDelete }: { entry: SchemaDiaryEntry; onDelete: () => void | Promise<void> }) {
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  const emotions = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));
  const kind = schemaEntryKind(entry);
  return (
    <EntryShell
      type="schema"
      kind={kind}
      title={schemas.length > 0 ? schemas.slice(0, 2).map(s => s!.name).join(' · ') : kind === 'thought' ? undefined : 'Дневник схем'}
      time={fmtTime(entry.createdAt)}
      text={entry.trigger}
      preview={emotions.length > 0 && <div className="cd-entry-meta">{emotions.slice(0, 4).map(e => e.label).join(' · ')}</div>}
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

export function ModeEntry({ entry, onDelete }: { entry: ModeDiaryEntry; onDelete: () => void | Promise<void> }) {
  const mode = getModeById(entry.modeId);
  return (
    <EntryShell
      type="mode"
      kind={modeEntryKind(entry)}
      title={mode ? mode.name : 'Дневник режимов'}
      time={fmtTime(entry.createdAt)}
      text={entry.situation}
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

export function GratitudeEntry({ entry, onDelete }: { entry: GratitudeDiaryEntry; onDelete: () => void | Promise<void> }) {
  const n = entry.items.length;
  return (
    <EntryShell
      type="gratitude"
      kind="gratitude"
      title={`${n} ${n === 1 ? 'пункт' : n < 5 ? 'пункта' : 'пунктов'}`}
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
