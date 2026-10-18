// Записи дневника с этим паттерном — только относящиеся к нему, свежие сверху.
// Карточки записей — готовые SchemaEntry/ModeEntry дневника сайта (раскрытие и
// удаление с подтверждением «Удалить» → «Удалить навсегда» уже в них), второй
// отрисовки нет. Честное пустое состояние, без выдуманных примеров.
import { SchemaEntry, ModeEntry } from '../../sections/diary/EntryCards';
import { fmtDateKey, fmtDayMonth } from '../../sections/diary/dateHelpers';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

interface Props {
  kind: MyCardsKind;
  entries: SchemaDiaryEntry[] | ModeDiaryEntry[];
  onDeleteEntry: (entryId: number) => void;
  emptyText: string;
}

const dayOf = (iso: string) => fmtDayMonth(fmtDateKey(iso));

export function PatternEntriesSection({ kind, entries, onDeleteEntry, emptyText }: Props) {
  return (
    <section className="ps-block">
      <div className="ds-label">Записи дневника</div>
      {entries.length === 0 ? (
        <p className="ps-empty">{emptyText}</p>
      ) : (
        <div className="ps-entries">
          {kind === 'schema'
            ? (entries as SchemaDiaryEntry[]).map((e) => (
                <div key={e.id}>
                  <div className="ps-entry-date">{dayOf(e.createdAt)}</div>
                  <SchemaEntry entry={e} onDelete={() => onDeleteEntry(e.id)} />
                </div>
              ))
            : (entries as ModeDiaryEntry[]).map((e) => (
                <div key={e.id}>
                  <div className="ps-entry-date">{dayOf(e.createdAt)}</div>
                  <ModeEntry entry={e} onDelete={() => onDeleteEntry(e.id)} />
                </div>
              ))}
        </div>
      )}
    </section>
  );
}
