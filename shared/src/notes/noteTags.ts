// Темы дня в заметке к дню — один список на выбор (NoteTagsPicker) и показ (вид «День»
// истории, HistoryDayView). До 2026-11 подписи жили только в NoteTagsPicker.tsx, и
// история рисовала сохранённые id как есть: «work», «creativity» (аудит, today-history-day).
// Сервер хранит id; подпись берётся отсюда.

export const NOTE_TAGS = [
  { id: 'work', label: 'Работа' },
  { id: 'relations', label: 'Отношения' },
  { id: 'health', label: 'Здоровье' },
  { id: 'loneliness', label: 'Одиночество' },
  { id: 'rest', label: 'Отдых' },
  { id: 'family', label: 'Семья' },
  { id: 'creativity', label: 'Творчество' },
  { id: 'anxiety', label: 'Тревога' },
  { id: 'joy', label: 'Радость' },
  { id: 'body', label: 'Тело' },
] as const;

const LABEL: ReadonlyMap<string, string> = new Map(
  NOTE_TAGS.map((t) => [t.id, t.label]),
);

/**
 * Подписи сохранённых тем по порядку сохранения. Незнакомый id (тема, которой больше
 * нет в списке) не показывается: сырой id на экране читается поломкой, а не темой.
 */
export function noteTagLabels(
  ids: readonly string[],
): { id: string; label: string }[] {
  return ids.flatMap((id) => {
    const label = LABEL.get(id);
    return label ? [{ id, label }] : [];
  });
}
