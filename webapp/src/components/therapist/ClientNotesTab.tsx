import { useState, type CSSProperties } from 'react';
import '../../styles/therapist-tabs.css';
import { buildNoteItems, countByFilter, filterNotes, FILTERS, type DiaryEntry, type ModeNoteData, type NoteFilter, type SchemaNoteData } from './notesModel';
import { NoteCard } from './NoteCard';
import { TabTitle } from './TabTitle';
import { PaperEmpty } from '../art/PaperEmpty';
import { Pebbles } from '../art/PaperArt';
import { LineTabs } from '../LineTabs';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

interface Props { clientSchemaNotesData: SchemaNoteData[]; clientModeNotesData: ModeNoteData[]; clientDiary: DiaryEntry[] }

export function ClientNotesTab({ clientSchemaNotesData, clientModeNotesData, clientDiary }: Props) {
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const all = buildNoteItems(clientDiary, clientSchemaNotesData, clientModeNotesData);

  if (all.length === 0) {
    return (
      <div className="ds-page tb-page--narrow">
        <PaperEmpty art={Pebbles}>Клиент ещё не заполнял дневник</PaperEmpty>
      </div>
    );
  }
  const counts = countByFilter(all);
  const shown = filterNotes(all, filter);
  return (
    <div className="ds-page tb-page--narrow">
      <div className="ds-head-row tb-notes-head">
        <TabTitle title="Записи клиента" className="tb-tab-title--desk" />
        <LineTabs look="scroll" label="Тип записей" value={filter} onPick={setFilter} tabs={FILTERS.map(f => (
          { id: f.id, label: <>{f.label}<span className="ds-count lt-count">{counts[f.id]}</span></> }
        ))} />
      </div>
      {shown.length === 0 ? <PaperEmpty>В этой категории записей нет</PaperEmpty> : (
        <div className="pp-leaf tb-notes" style={{ '--h': ENTITY_LOOK.diary.hue } as CSSProperties}>{/* один лист, r2 */}
          {shown.map(item => <NoteCard key={item.key} item={item} expanded={openKey === item.key}
            onToggle={() => setOpenKey(openKey === item.key ? null : item.key)} />)}
        </div>
      )}
    </div>
  );
}
