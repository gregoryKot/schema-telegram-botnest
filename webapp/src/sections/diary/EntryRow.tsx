import type { DiaryType } from '../../types';
import { SchemaEntry, ModeEntry, GratitudeEntry } from './EntryCards';
import type { DayEntry } from './dayModel';
import type { PatternTarget } from '../schemas/patternRoute';

// Одна карточка ленты по типу дневника; трекер дня — в строке даты (DayHead), не карточкой.
export function EntryRow({ item, onDelete, onOpenPattern }: { item: DayEntry; onDelete: (type: DiaryType, id: number) => Promise<void>; onOpenPattern?: (t: PatternTarget) => void }) {
  const del = () => onDelete(item._type, item.entry.id);
  if (item._type === 'schema') return <SchemaEntry entry={item.entry} onDelete={del} onOpenPattern={onOpenPattern} />;
  if (item._type === 'mode') return <ModeEntry entry={item.entry} onDelete={del} onOpenPattern={onOpenPattern} />;
  return <GratitudeEntry entry={item.entry} onDelete={del} />;
}
