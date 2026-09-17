// Записи дневника с этим паттерном — только относящиеся к нему, свежие
// сверху. Переиспользует уже готовые карточки записей (SchemaCard/ModeCard —
// умеют разворачиваться и делиться), не рисует их заново (правило «одна
// механика — один компонент»). Честное пустое состояние, без выдуманных
// примеров.
import { SectionLabel } from '../SectionLabel';
import { DiaryPanel } from '../diary/diaryUi';
import { SchemaCard } from '../diary/diaryCards/SchemaCard';
import { ModeCard } from '../diary/diaryCards/ModeCard';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';
import type { MyCardsKind } from '../myCards/useMyCards';

interface Props {
  kind: MyCardsKind;
  color: string;
  entries: SchemaDiaryEntry[] | ModeDiaryEntry[];
  onDeleteEntry: (entryId: number) => void;
  emptyText: string;
}

export function PatternEntriesSection({
  kind,
  color,
  entries,
  onDeleteEntry,
  emptyText,
}: Props) {
  return (
    <div>
      <SectionLabel>Записи дневника</SectionLabel>
      {entries.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            padding: '4px 2px',
          }}
        >
          {emptyText}
        </div>
      ) : (
        <DiaryPanel>
          {kind === 'schema'
            ? (entries as SchemaDiaryEntry[]).map((e) => (
                <SchemaCard
                  key={e.id}
                  entry={e}
                  color={color}
                  onDelete={() => onDeleteEntry(e.id)}
                />
              ))
            : (entries as ModeDiaryEntry[]).map((e) => (
                <ModeCard
                  key={e.id}
                  entry={e}
                  color={color}
                  onDelete={() => onDeleteEntry(e.id)}
                />
              ))}
        </DiaryPanel>
      )}
    </div>
  );
}
