import { useState } from 'react';
import '../../styles/therapist-tabs.css';
import { buildNoteItems, countByFilter, filterNotes, FILTERS, type DiaryEntry, type ModeNoteData, type NoteFilter, type SchemaNoteData } from './notesModel';
import { NoteCard } from './NoteCard';

interface Props {
  clientSchemaNotesData: SchemaNoteData[];
  clientModeNotesData: ModeNoteData[];
  clientDiary: DiaryEntry[];
}

export function ClientNotesTab({ clientSchemaNotesData, clientModeNotesData, clientDiary }: Props) {
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const all = buildNoteItems(clientDiary, clientSchemaNotesData, clientModeNotesData);

  if (all.length === 0) {
    return (
      <div className="ds-page tb-page tb-page--narrow">
        <div className="tb-empty tb-empty--center">Клиент ещё не заполнял дневник</div>
      </div>
    );
  }

  const counts = countByFilter(all);
  const shown = filterNotes(all, filter);

  return (
    <div className="ds-page tb-page tb-page--narrow">
      <div className="ds-head-row tb-ysq-head-row">
        <h2 className="tb-h32">Записи клиента</h2>
        <div className="ds-seg" role="tablist">
          {FILTERS.map(f => (
            <button key={f.id} role="tab" aria-selected={filter === f.id}
              className={`ds-seg-btn${filter === f.id ? ' is-active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}<span className="tb-seg-n">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tb-notes">
        {shown.length === 0 && <div className="tb-empty">В этой категории записей нет</div>}
        {shown.map(item => (
          <NoteCard key={item.key} item={item} expanded={openKey === item.key}
            onToggle={() => setOpenKey(openKey === item.key ? null : item.key)} />
        ))}
      </div>
    </div>
  );
}
