// Переходы из раскрытой записи «Записей» к карточке схемы или режима — тот же лист, что в «Моих паттернах»
// (PatternSheet). Только существующие в справочнике: удалённый id ссылкой не становится.
import { getModeById, getSchemaById } from '../../schemaTherapyData';
import type { PatternTarget } from '../schemas/patternRoute';
import type { DayEntry } from './dayModel';

export interface PatternLink extends PatternTarget { name: string }

export function entryPatternLinks(item: DayEntry): PatternLink[] {
  if (item._type === 'mode') {
    const mode = getModeById(item.entry.modeId);
    return mode ? [{ kind: 'mode', id: mode.id, name: mode.name }] : [];
  }
  if (item._type !== 'schema') return [];
  return item.entry.schemaIds.flatMap((id): PatternLink[] => {
    const s = getSchemaById(id);
    return s ? [{ kind: 'schema', id: s.id, name: s.name }] : [];
  });
}
