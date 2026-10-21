/** «воскресенье, 18 октября» — строка под приветствием на телефоне (как в мини-аппе). */
export function formatGreetingDate(now: Date = new Date()): string {
  const dow = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  return `${dow}, ${date}`;
}
