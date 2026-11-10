import type { DiaryType } from '../../types';
import { SchemaEntry, ModeEntry, GratitudeEntry } from './EntryCards';
import type { DayEntry } from './dayModel';

// Одна карточка ленты по типу дневника; трекер дня — в строке даты (DayHead), не карточкой.
export function EntryRow({ item, onDelete }: { item: DayEntry; onDelete: (type: DiaryType, id: number) => Promise<void> }) {
  const del = () => onDelete(item._type, item.entry.id);
  if (item._type === 'schema') return <SchemaEntry entry={item.entry} onDelete={del} />;
  if (item._type === 'mode') return <ModeEntry entry={item.entry} onDelete={del} />;
  return <GratitudeEntry entry={item.entry} onDelete={del} />;
}
