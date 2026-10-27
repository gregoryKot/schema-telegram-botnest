// Хелперы главной «Сегодня»: приветствие и маркер состояния задания.
// Название задания — resolveTaskDisplayText из shared/src/tasks/taskTitle.

/** «Привет, Анна» / «Привет» без имени. Без времени суток: одинаково для обеих форм обращения. */
export function homeGreeting(firstName: string): string {
  return firstName ? `Привет, ${firstName}` : 'Привет';
}

// Маркер состояния — типографика (правило "род/ты-вы/эмодзи" CLAUDE.md, R4):
// сделано ✓, не сделано ×, ещё не решено (в работе) ·.
export function taskStatusMark(done: boolean | null): string {
  if (done === true)  return '✓';
  if (done === false) return '×';
  return '·';
}
