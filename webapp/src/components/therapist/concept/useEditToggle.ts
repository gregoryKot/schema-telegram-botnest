import { useState } from 'react';

// Свёрнутость карточек выбора вида «Поля»: ничего не выбрано — выбор открыт
// сразу и кнопки нет (прятать нечего); выбрано — спокойный вид, «Изменить»
// раскрывает. Открытый выбор не сворачивается сам: первый клик из пустого
// состояния оставляет перечень под пальцем.
export function useEditToggle(hasSelection: boolean) {
  const [open, setOpen] = useState(!hasSelection);
  return {
    editing: open || !hasSelection,
    canToggle: hasSelection,
    toggle: () => setOpen((v) => !v),
  };
}
