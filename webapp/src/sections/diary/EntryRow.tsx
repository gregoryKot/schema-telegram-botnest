import type { DiaryType } from '../../types';
import { SchemaEntry, ModeEntry, GratitudeEntry } from './EntryCards';
import { TrackerEntry } from './TrackerEntry';
import type { AnyEntry } from './diaryModel';

// Одна строка ленты по типу: запись трёх дневников или трекер дня.
export function EntryRow({ item, onDelete, onOpenTrackerHistory }: {
  item: AnyEntry;
  onDelete: (type: DiaryType, id: number) => void;
  onOpenTrackerHistory?: () => void;
}) {
  if (item._type === 'tracker') return <TrackerEntry day={item.entry} onOpen={onOpenTrackerHistory} />;
  const del = () => onDelete(item._type, item.entry.id);
  if (item._type === 'schema') return <SchemaEntry entry={item.entry} onDelete={del} />;
  if (item._type === 'mode') return <ModeEntry entry={item.entry} onDelete={del} />;
  return <GratitudeEntry entry={item.entry} onDelete={del} />;
}
