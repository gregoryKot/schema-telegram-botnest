// Запись истории листа несёт не один id, а СТЕК: id всех листов, открытых к
// этому моменту, снизу вверх (`__sheetStack`). Один id ломал вложенность: лист
// поверх листа перезаписывал `__sheetId`, и нижний лист видел «моей записи
// больше нет» и закрывался сам в момент открытия верхнего (SchemaDetailSheet →
// «Поделиться» закрывал всю карточку схемы). Лист закрывается, когда его id
// пропал из стека: возврат на запись родителя закрывает только ребёнка.
// `__sheetId` оставлен — id верхнего листа, на нём сидят тесты.
interface SheetEntryState {
  __sheetId?: string;
  __sheetStack?: string[];
}

/** Стек листов записи истории. Запись прошлой версии (только `__sheetId`) —
 * стек из одного id; запись без листов — пустой. */
export function sheetStackOf(state: unknown): string[] {
  const s = (state ?? {}) as SheetEntryState;
  if (Array.isArray(s.__sheetStack)) return s.__sheetStack;
  return s.__sheetId ? [s.__sheetId] : [];
}

/** State новой записи, которую заводит лист `id` поверх текущей `state`. */
export function pushSheetState(state: unknown, id: string) {
  return {
    ...((state as object | null) ?? {}),
    __sheetId: id,
    __sheetStack: [...sheetStackOf(state), id],
  };
}
