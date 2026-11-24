import { SCHEMA_DOMAINS, getModeById } from '../../schemaTherapyData';

const flatSchemas = SCHEMA_DOMAINS.flatMap((d) => d.schemas);

/** Заголовок и ярлык записи дневника — одна функция для превью обзора и списка заметок. */
export function diaryTitle(e: { type: 'schema' | 'mode' | 'gratitude'; schemaIds?: string[]; modeId?: string }): { title: string; typeLabel: string } {
  if (e.type === 'schema') {
    const ids = e.schemaIds ?? [];
    const first = flatSchemas.find((s) => s.id === ids[0]);
    const extra = ids.length > 1 ? ` +${ids.length - 1}` : '';
    return { title: (first ? first.name : ids.join(', ') || 'Схема') + extra, typeLabel: 'Дневник схем' };
  }
  if (e.type === 'mode') {
    const mode = getModeById(e.modeId ?? '');
    return { title: mode ? mode.name : (e.modeId ?? 'Режим'), typeLabel: 'Дневник режимов' };
  }
  return { title: 'Благодарность', typeLabel: 'Дневник благодарности' };
}
