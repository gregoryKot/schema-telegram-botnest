import { useState } from 'react';
import '../../styles/therapist-tabs.css';
import { buildNoteItems, countByFilter, filterNotes, FILTERS, type DiaryEntry, type ModeNoteData, type NoteFilter, type SchemaNoteData } from './notesModel';
import { NoteCard } from './NoteCard';
import { TabTitle } from './TabTitle';
import { PaperEmpty } from '../art/PaperEmpty';
import { Pebbles } from '../art/PaperArt';
import { useTabsBar } from './useTabsBar';

interface Props { clientSchemaNotesData: SchemaNoteData[]; clientModeNotesData: ModeNoteData[]; clientDiary: DiaryEntry[] }

export function ClientNotesTab({ clientSchemaNotesData, clientModeNotesData, clientDiary }: Props) {
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { ref: barRef, onScroll: onBarScroll, fadeClassName } = useTabsBar(filter);
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
        <TabTitle title="Записи клиента" motif="pebbles" className="tb-tab-title--desk" />
        {/* Фильтр — одна строка с прокруткой и маской у края, как вкладки карточки (useTabsBar, r1). */}
        <div className={`ds-seg ds-seg--scroll tb-notes-filter${fadeClassName}`} role="tablist" ref={barRef} onScroll={onBarScroll}>
          {FILTERS.map(f => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={`ds-seg-btn${filter === f.id ? ' is-active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}<span className="ds-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tb-notes">
        {shown.length === 0 && <PaperEmpty>В этой категории записей нет</PaperEmpty>}
        {shown.map(item => (
          <NoteCard key={item.key} item={item} expanded={openKey === item.key}
            onToggle={() => setOpenKey(openKey === item.key ? null : item.key)} />
        ))}
      </div>
    </div>
  );
}
