import type { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, EmotionEntry } from '../../types';
import { EMOTIONS, getModeById, getSchemaById } from '../../schemaTherapyData';
import { ModeEntryShare } from '../../components/diary/ModeEntryShare';
import { GratitudeShare } from '../../components/diary/GratitudeShare';
import { fmtTime, fmtDateKey, fmtDayMonth } from './dateHelpers';
import { schemaEntryRows, modeEntryRows } from './entryRows';
import { DeleteBtn } from './DeleteBtn';
import { modeEntryKind, schemaEntryKind } from './entryKind';
import { entryLook } from './feedLook';
import { EntryFields } from './EntryFields';
import { EntryMore, EntryShell } from './EntryShell';
import '../../styles/client-diary.css';
// Карточки записей трёх дневников в ленте «Записей»: вид — по типу записи (feedLook), каркас — EntryShell.

export function SchemaEntry({ entry, onDelete }: { entry: SchemaDiaryEntry; onDelete: () => void | Promise<void> }) {
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  const emotions = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));
  const kind = schemaEntryKind(entry);
  return (
    <EntryShell
      look={entryLook({ _type: 'schema', entry })}
      kind={kind}
      title={schemas.length > 0 ? schemas.slice(0, 2).map(s => s!.name).join(' · ') : kind === 'thought' ? undefined : 'Дневник схем'}
      time={fmtTime(entry.createdAt)}
      text={entry.trigger}
      preview={emotions.length > 0 && <div className="cd-entry-meta">{emotions.slice(0, 4).map(e => e.label).join(' · ')}</div>}
    >
      {open => open && <EntryMore fields={<EntryFields rows={schemaEntryRows(entry)} />} remove={<DeleteBtn onClick={onDelete} />} />}
    </EntryShell>
  );
}

export function ModeEntry({ entry, onDelete }: { entry: ModeDiaryEntry; onDelete: () => void | Promise<void> }) {
  const mode = getModeById(entry.modeId);
  return (
    <EntryShell
      look={entryLook({ _type: 'mode', entry })}
      kind={modeEntryKind(entry)}
      title={mode ? mode.name : 'Дневник режимов'}
      time={fmtTime(entry.createdAt)}
      text={entry.situation}
    >
      {open => open ? (
        <EntryMore
          fields={<EntryFields rows={modeEntryRows(entry)} />}
          share={<ModeEntryShare mode={mode} healthyResponse={entry.healthyResponse} entry={entry} dateLabel={fmtDayMonth(fmtDateKey(entry.createdAt))} />}
          remove={<DeleteBtn onClick={onDelete} />}
        />
      ) : entry.actualNeed && (
        <div className="cd-entry-meta">Что было нужно: {entry.actualNeed.slice(0, 80)}</div>
      )}
    </EntryShell>
  );
}

export function GratitudeEntry({ entry, onDelete }: { entry: GratitudeDiaryEntry; onDelete: () => void | Promise<void> }) {
  const n = entry.items.length;
  return (
    <EntryShell
      look={entryLook({ _type: 'gratitude', entry })}
      kind="gratitude"
      title={`${n} ${n === 1 ? 'пункт' : n < 5 ? 'пункта' : 'пунктов'}`}
    >
      {open => (
        <>
          <ul className="cd-grat">
            {(open ? entry.items : entry.items.slice(0, 2)).map((item, i) => (
              <li key={i}><span className="cd-grat-num">{String(i + 1).padStart(2, '0')}</span>{item}</li>
            ))}
            {!open && n > 2 && <li className="cd-grat-more">ещё {n - 2}</li>}
          </ul>
          {open && <EntryMore share={<GratitudeShare items={entry.items} dateLabel={fmtDayMonth(entry.date)} />} remove={<DeleteBtn onClick={onDelete} />} />}
        </>
      )}
    </EntryShell>
  );
}
