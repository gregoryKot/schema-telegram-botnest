// Хелперы экрана «Сегодня» (приветствие, дата, маркер статуса задач).
// Вынесено из TodaySection.tsx (правило №10). Название задания —
// resolveTaskDisplayText из shared/src/tasks/taskTitle.

export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

// Приветствие на телефоне — как в мини-аппе: «Привет» без времени суток
// (одинаково звучит на «ты» и на «вы»).
export function phoneGreeting(firstName: string): string {
  return firstName ? `Привет, ${firstName}` : 'Добро пожаловать';
}

export function formatHeaderDate(): string {
  const now = new Date();
  const dow  = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date}`;
}

export function readLocalIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

// Маркер состояния — типографика (правило "род/ты-вы/эмодзи" CLAUDE.md, R4):
// сделано ✓, не сделано ×, ещё не решено (в работе) ·.
export function taskStatusMark(done: boolean | null): string {
  if (done === true)  return '✓';
  if (done === false) return '×';
  return '·';
}
