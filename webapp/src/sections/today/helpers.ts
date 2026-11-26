// Хелперы главной «Сегодня»: приветствие и маркер состояния задания.
// Название задания — resolveTaskDisplayText из shared/src/tasks/taskTitle.

/** «Привет, Анна» / «Привет» без имени. Без времени суток: одинаково для обеих форм обращения. */
export function homeGreeting(firstName: string): string {
  return firstName ? `Привет, ${firstName}` : 'Привет';
}

// Отметка в квадрате карточки «Сегодня» — типографика (правило "род/ты-вы/эмодзи"
// CLAUDE.md, R4): сделано ✓, не вышло ×, в работе — пусто. Одинокая «·» читалась
// как сломанная иконка (QA 2026-11, A-З8); в полном списке статус — бейдж.
export function taskStatusMark(done: boolean | null): string {
  if (done === true)  return '✓';
  if (done === false) return '×';
  return '';
}
